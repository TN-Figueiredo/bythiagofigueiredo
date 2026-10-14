# Fase de manutenção (NAS e forja), M3b, lado da forja: copiador, `conferir-b2`, varredura completa e instalação. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pôr na forja os dois programas que dão ao arquivo do site uma cópia conferida no NAS e no B2: o **copiador** (baixa pela rota do site, grava no NAS, relê, confere e informa; grava o canário; relê o que já está lá, inclusive a varredura completa depois de um silêncio da casa) e o **`conferir-b2`** (baixa do B2 pelo `fileId`, decifra, confere e informa, com o controle negativo e o canário na frente); mais o `pode-desligar` do Mac, a ferramenta do dono que restaura uma versão do B2 pelo `fileId` atestado, a instalação dos três blocos do `pulso.sh` e os arquivos de comandos que o dono roda para instalar tudo e para a mudança de casa.

**Architecture:** código do kit em `~/Workspace/forja/ferramentas/arquivo/` (git local, sem remoto), **só biblioteca padrão do Python 3.12** e o `rclone` que a M3a instalou; uma biblioteca comum (`comum.py`), um cliente do site (`cliente_site.py`; `site.py` colidiria com o módulo `site` da biblioteca padrão), um cliente do B2 (`b2.py`) e os dois programas (`copiador/copiar.py`, `conferir-b2/conferir.py`), todos provados no Mac contra um site falso e um B2 falso que são servidores HTTP de verdade em `127.0.0.1`, e um `rclone` falso no `PATH`. Quem decide é sempre o site: a forja lê, mede e informa; nunca deduz "nada devido", "ausente" nem "terminou" sozinha. No site entra só o subcomando `pode-desligar` do `scripts/obs-arquivo.ts`, puro nas decisões. Toda escrita na forja é do dono, por arquivos de comandos.

**Tech Stack:** Python 3.12.3 (`/usr/bin/python3` da forja; F30), `rclone` ≥ 1.60 (M3a), API nativa do B2 (`b2api/v4`, conferida na documentação oficial em 14/10), bash, cron, `flock`, healthchecks.io; no site, TypeScript estrito, Vitest, `pg`.

**Estado do código (revisão 2, 14/10):** todo o Python e os arquivos de comandos deste plano foram escritos e rodados pelo redator numa cópia de rascunho, no Mac, **no Python 3.12.13** (`/opt/homebrew/bin/python3.12`, a mesma linha 3.12 da forja) e também no 3.14: `teste_comum.py`, `teste_site_b2.py`, `teste_copiador.py`, `teste_conferir_b2.py`, `teste_restaurar.py` e o `teste_pulso_arquivo.py` alterado (Tarefa 6) terminam com `0 falha(s)` nas duas versões, e os `.sh` passam em `bash -n`. O TypeScript da Tarefa 7 **não** foi rodado (não se escreve no repositório durante a redação). Contrato seguido: **r2.3** (`.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md`, "Versão r2.3, 14/10"; a r2.3 só acrescenta o vermelho `b2_atrasado` do lado do site, e o kit não muda; **o `pulso_arquivo.py` e o `teste_pulso_arquivo.py` foram regerados sobre a M3a COMMITADA (`8c160baae`, blocos extraídos do plano da M3a), com `teste_pulso_arquivo.py` em `0 falha(s)` no 3.12.13 junto dos outros cinco (R2-F1 do Yannis)**; a rodada 2.2 alinhou o kit às duas decisões do controlador sobre os Pedidos r2 e rodou de novo os seis testes no 3.12.13: `0 falha(s)` em cada); o site falso dos testes segue o contrato à risca e espelha o Zod das rotas (corpo fora do esquema = `400 VALIDATION_ERROR`). O que mudou desta versão para a anterior, achado por achado: `.superpowers/sdd/manutencao-nas/resolucao-plano-m3b-forja.md`.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (aprovado em 14/10, commit `8b4dd7b61`). Trechos que este plano implementa: `05` §15.1 (linhas M3b e "A mudança de casa"), §16.5 (parte da forja) e §16.11; `02` §9.4 (árvore, sentinela, `_recebendo`, `_canario`), §10.6 (copiador, rodízio, atraso, vigilância), §10.9 (o `conferir-b2`), §10.10 (`pode-desligar`, varredura completa, relógio); `03` §12.1 a §12.3; `06` §18 itens 20, 27, 30, 33, 74, 76, 79, 132 (parte do kit), 134 (parte do kit e instalação), 149, 150 (registro), 172 (parte da forja); entradas P7, P14, P20, P24, P26, P28, P32, P34 (nome da sobra), P37, P39 (linha "saída boa" de 16.11), P53 e P59 do `06` §19.4. Plano consumido: `docs/superpowers/plans/2026-10-14-manutencao-nas-m3a-casa.md` ("Interfaces registradas para a M3b", Tarefa 6). Contrato das rotas: `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (do redator do lado do site, dono do contrato).

## Global Constraints

- **NAS e forja: escrita é do dono, sem exceção.** O agente nunca roda `ssh forja '<escreve>'`, `scp`, `install`, `systemctl`, `crontab` nem `mv` na forja. Leitura por `ssh forja '<leitura>'` é permitida. O agente prepara **arquivos de comandos** (curtos, um por linha) em `.superpowers/sdd/manutencao-nas/m3b/`, com uma linha curta que os roda e a saída em `.superpowers/sdd/manutencao-nas/saidas/`. Nada para colar, salvo as exceções do `05` §16: **a linha do cron, por `crontab -e`** (é a única desta etapa) e as URLs do healthchecks.io, digitadas pelo dono na sessão (vêm do cofre, nunca de arquivo).
- **`sudo` na forja pede senha** (CP17). Esta etapa não precisa de `sudo`: `/opt/arquivo` e as pastas dele são do `thiago` desde a M3a (`instalar-casa-forja.sh`, passo 2/4). O único `sudo` é o do relógio (`timedatectl set-ntp true`), num arquivo próprio aberto com `ssh -t`.
- **O sistema falha em VERDE.** Para cada passo o plano diz primeiro o que acontece quando o dado NÃO existe (plano vazio, pasta não montada, sentinela ausente, canário que não subiu, registro velho) e só depois o que acontece quando dá erro. Nenhum programa deduz "nada devido", "ausente" ou "terminou": quem diz é o site, e o que o site não disse é falha.
- **Quem decide é o site.** O site nunca manda à forja o hash esperado; a forja nunca compara o que leu com um valor do registro. A forja compara só o que ela mesma tem nas mãos: o sha256 dos bytes que baixou contra o cabeçalho da mesma resposta, e o arquivo relido contra o que ela gravou.
- **Orçamento acoplado da forja** (CLAUDE.md, "A forja"): esta etapa **não toca** a linha do cron da fila, o `timeout -k 30s 25m`, o `STALE_THRESHOLD_MINUTES` nem o corte de 70 min do pulso (item 33). Os dois programas novos têm trava, `timeout` e registro próprios; a conta está em "Decisões", D-F8.
- **Kit:** toda mudança termina em `git -C ~/Workspace/forja/ferramentas add -- <caminhos>` e `git -C ~/Workspace/forja/ferramentas commit -m "<tipo>: <descrição>" -- <caminhos>`; nada vai à forja com mudança sem commit (o arquivo de instalação confere `git status --porcelain` antes do `scp`).
- **Site:** commits no `staging`, um por tarefa, por caminho explícito; arquivo novo leva `git add -- <caminhos>` antes do `git commit -- <caminhos>`; nunca `git add -A`, stash ou reset. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. `.superpowers/` está no `.gitignore` e nunca entra em commit.
- **Variável com padrão = teste que a apaga** e afirma o padrão (item 79; regra "Env com fallback" do CLAUDE.md).
- **Sem datas-meta;** o relógio real desta etapa é a primeira selagem, devida em 28/11 (`05` §15.2), que só acontece com o lado do site em produção, `OBS_ARQUIVO=on` e os dois programas instalados.

## Review Focus

1. **Controle negativo que diz "ausente" por erro.** Com a API do B2, "não existe" é uma listagem 200 sem versão `upload` mais nova que um `hide` (a versão `start`, envio em curso, é pulada; só `start` é `sem_acesso`); qualquer outra coisa (401, 5xx, rede, corpo ilegível) é `sem_acesso`. O teste põe o B2 falso fora do ar e afirma zero `ausente` e desfecho `sem_acesso` (Tarefas 2 e 4).
2. **`fileId` desligado dos bytes.** O `conferir-b2` baixa **pelo `fileId`** que ele mesmo listou (`b2_download_file_by_id`) e informa esse `fileId` com o sha256 desses bytes. Listar por um caminho e baixar por outro deixaria uma corrida entre a listagem e a cópia agendada do NAS (Tarefas 2 e 4, D-F2).
3. **Pasta não montada com `nofail`.** Sem o NFS, `/mnt/arquivo/escrita/<filho>` é disco local da forja. O copiador exige `os.path.ismount` **e** a sentinela no filho em que grava; sem os dois, `nas_fora`, nada gravado, nada informado como ausente (Tarefas 1 e 3; item 27).
4. **Registro que fica verde sem trabalho.** `desfecho: ok` só com o plano respondido e cumprido: informe recusado (`informe_recusado`), unidade que falhou duas vezes (`unidade_falhou`), pulo que o plano não devia ter pedido (`incompleto`), arquivo ilegível (`nas_ilegivel`), canário recusado (`controle_falhou`), arquivo `sem_acesso` no B2 e "pediu e nenhum presente" (`incompleto`) nunca dão `ok`. `pedidos: 0` no `conferir-b2` só é verde com o `estado` que o **site** mandou por filho (`aguardando_primeira_selagem` ou `nada_devido`), e `nada_devido` só com o canário do mesmo filho aceito na mesma execução (K4).
5. **Varredura que "termina" pela forja, ou que nunca abre.** A forja não sabe quando a varredura terminou: segue as páginas que o site devolve e informa o que leu. O fim é o site deixar de devolver `modo: completo` (Tarefa 3, caso 10; item 172). E o copiador pede o **plano antes do batimento** (K3): o batimento desta execução não apaga o silêncio que o site precisa medir (o site também abre a varredura no próprio `heartbeat`, C8 r2).
6. **Arquivo final sobrescrito.** Nenhum caminho do copiador grava por cima de um arquivo final: grava em `_recebendo`, relê, e só leva ao final por `link` + `unlink` (falha se o destino existe); destino existente com outro sha256 fica intacto e é informado (item 27).
7. **Leitor que só funciona no Mac.** O `csv` da biblioteca padrão não devolve `None` no Python 3.12 da forja; o kit tem leitor próprio e o `teste_tudo.sh` só roda no 3.12 (K1).

---

## Fatos usados (com fonte)

| Fato | Fonte |
|---|---|
| Crontab da forja, 4 linhas: `0 * * * * /opt/agente/docs/pulso.sh`; `*/3` retentar; `*/10 ... timeout -k 30s 25m ... fila_intel.py --cron`; `17 10,22 * * *` stats. Sem `/opt/arquivo` e sem `/mnt/arquivo` (a M3a ainda não rodou) | Lido pelo agente em 14/10 às 09:17 por `ssh forja 'crontab -l; ls ...'` |
| Python do venv do agente: 3.12.3, `httpx` 0.28.1; relógio da forja em `-03` | idem |
| Âncora do pulso: `[ "$ok" -eq 1 ] && alvo="$URL" ...` na linha 130 de `/opt/agente/docs/pulso.sh` | idem (`grep -n`) |
| O kit não tem `arquivo/` ainda: a M3a cria `arquivo/pulso_arquivo.py`, `teste_pulso_arquivo.py`, `nova_chave_arquivo.py`, `configurar_rclone.py`, as montagens e o instalador | `ls ~/Workspace/forja/ferramentas` em 14/10; plano da M3a, "Estrutura de arquivos" |
| `/opt/arquivo`, `log/`, `ferramentas/`, `estado/` (755) e `chaves/` (700) nascem na M3a, donos `thiago` | plano da M3a, Tarefa 2, `instalar-casa-forja.sh` passo 2/4 |
| Chave de cada programa em `/opt/arquivo/chaves/{copiador,conferidor}.chave`, `forja_` + 43 caracteres, `0600`; caminho trocável por `ARQUIVO_CHAVE_ARQ`; base trocável por `ARQUIVO_BASE` | plano da M3a, "Interfaces registradas" e Tarefa 3 |
| Formatos de `copiador.jsonl`, `conferir-b2.jsonl` e `estado/plano.json`; só `modo: "cron"` conta para o pulso; `pedidos`/`informados`/`estado` no do B2 | plano da M3a, "Interfaces registradas" e Tarefa 6 (`_MOLDE_JSONL`, `_PLANO`) |
| Remotos do `rclone`: `b2arq:` (tipo `b2`, chave de leitura da forja) e `arq:` (tipo `crypt`, `remote = b2arq:<bucket>/site-arquivo`, `filename_encryption = off`) | plano da M3a, "Interfaces registradas" e Tarefa 5 |
| Tarefa do NAS para o B2 do arquivo às 06:10 do NAS; as outras começam até 05:50 | plano da M3a, P6; `saidas/nas-2026-10-14-0012.txt` |
| Cabeçalho da chave de API no site: `X-Pipeline-Key` | `apps/web/src/lib/pipeline/auth.ts:75` |
| CSV do arquivo: vírgula; `\n`; aspas dobradas; **nulo = campo vazio sem aspas, texto vazio = `""`**; primeira linha é cabeçalho; "uma linha sem nada, no meio do arquivo, é uma linha de um campo nulo" | `apps/web/src/lib/youtube/observatorio/arquivo/csv.ts:1-30` |
| Soma de controle: soma `BigInt` dos valores não nulos de **uma** coluna, como texto; nula quando a tabela não tem coluna somável | `apps/web/src/lib/youtube/observatorio/arquivo/conferir.ts:120-126`, `manifesto.ts:23-24` |
| `csv.QUOTE_NOTNULL` só afeta o **leitor** a partir da 3.13: no 3.12 o nulo volta como `""` (sonda em 3.12.13: `['1','']` no 3.12, `['1',None]` no 3.14). O kit tem leitor próprio do formato do C0.3 | Sonda do Yannis, 14/10 (crítico 1); contrato r2, C0.3 |
| API do B2 `b2api/v4`: `b2_authorize_account` (GET, Basic `keyId:key`) devolve `accountId`, `authorizationToken` e `apiInfo.storageApi.{apiUrl, downloadUrl, allowed.buckets[{id, name}]}`; o `accountId` **não** é o keyId; `b2_list_file_versions` tem `action` em `upload`, `start` (envio grande em curso), `hide`, `folder`; `b2_download_file_by_id` devolve `X-Bz-File-Name` e `X-Bz-Content-Sha1` (`none` em envio grande) e erra com 401, 403 `download_cap_exceeded`, 404 `not_found` | Documentação oficial da Backblaze, conferida em 14/10 (`backblaze.com/apidocs/b2-authorize-account`); revisão do Yannis, seção 4 |
| `scripts/obs-arquivo.ts` existe (E10 T7), fino, com a lógica em `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (`interpretar`, `rodar`, `USO`); conexão só por `OBS_ARQUIVO_DB_URL` | `scripts/obs-arquivo.ts:1-60`; commit `c18bd8e11` |
| Lista fechada de tabelas e classes da política | `02` §10.3 e §10.8 |

## Decisões deste plano (o que o spec deixou ao plano, ou que o plano muda com motivo)

| # | Decisão | Motivo |
|---|---|---|
| D-F1 | **Os programas usam só a biblioteca padrão e rodam com `/usr/bin/python3 -B`**, não com `/opt/agente/venv/bin/python` (`05` §16.5); **o leitor de CSV é próprio** (em fluxo, O(bytes), com caminho rápido para linha sem aspas) e **os testes rodam no Python 3.12** (`teste_tudo.sh` recusa outra versão) | P53: com o venv do agente, atualizá-lo podia quebrar o arquivo. O Python do sistema é o mesmo 3.12.3 (F30); sem dependência fora da biblioteca padrão não há o que um `pip` quebre. O `csv` da 3.12 não distingue nulo de texto vazio (Fatos); o portão no 3.14 aprovaria o que a forja reprova (K1). Desvio declarado das linhas do `05` §16.5 |
| D-F2 | **O `conferir-b2` fala com a API nativa do B2, `b2api/v4`** (`b2_authorize_account`, `b2_list_file_versions`, `b2_download_file_by_id`; `b2_list_buckets` com o `accountId` da autorização só quando a chave não traz a lista de buckets), com a chave de leitura que já está em `b2arq:`; **o `rclone` só decifra**, sobre uma pasta temporária local, por um remoto `crypt` montado em variáveis de ambiente com as senhas obscurecidas de `arq:` | (a) O `fileId` e o `uploadTimestamp` vêm da resposta da API, por contrato do B2; a M3a deixou NÃO VERIFICADO se o `rclone` 1.60.1 os mostra (bloco 10). (b) Os bytes conferidos são **os do `fileId` informado**: sem corrida entre listar e baixar. (c) "Não existe" vira lista vazia numa resposta 200, e todo o resto é erro: resolve o `CONTROLE-NEGATIVO: INCONCLUSIVO` que a M3a levou à M3b. (d) A restauração pelo `fileId` (Su1, `02` §10.10) usa o mesmo caminho. O spec diz "baixa pelo remoto cifrado": o arquivo continua cifrado de ponta a ponta e decifrado pela mesma chave do cofre; muda só quem faz o transporte |
| D-F3 | **Nome do objeto no B2 = `<prefixo de arq:>/<filho>/<caminho>` + sufixo `.bin`**, com o sufixo numa variável com padrão (`ARQ_B2_SUFIXO`, padrão `.bin`) | `rclone crypt` com `filename_encryption = off` acrescenta `.bin` (NÃO VERIFICADO para o TrueNAS: a M3a registra o nome cru no bloco 10). Se o bloco 10 mostrar outro sufixo, troca-se a variável no `.env`, sem código |
| D-F4 | **O canário é gravado pelo copiador uma vez por dia, por filho**, com 64 bytes aleatórios em hexadecimal, em `_canario/AAAA-MM-DD` (data de São Paulo); **o copiador apaga do NAS os canários com mais de 30 dias** e só os de nome `^\d{4}-\d{2}-\d{2}$` (`prova-m3a` fica); **os do B2 ficam** (a tarefa `COPY` não apaga; são 730 arquivos de 64 bytes por ano, e o dono pode limpá-los no painel quando quiser) | P20 |
| D-F5 | **Limite de banda e teto de bytes do `conferir-b2` ficam no programa:** banda por `ARQ_B2_BANDA_KIBPS` (padrão 1024 KiB/s, a internet é da casa do irmão); teto por dia e por mês com contador local em `estado/conferir-b2-bytes.json`, que vira à meia-noite e no dia 1 do relógio da forja; os valores do teto vêm do plano do site (P59). Parado no teto, o registro diz `teto_bytes` com a cor que o **site** devolveu no batimento (`teto_cor`, C8 r2.2): âmbar no primeiro dia, vermelho no segundo dia seguido, contados pelo site no histórico das execuções; o bloco do pulso fica verde com `teto_cor: "ambar"` e vermelho com `"vermelho"` ou sem cor (o pulso não conta dias); o piso de 2 vezes o arquivo faz o teto raro | P32, P59; contrato r2.2 (M6 do Phil) |
| D-F6 | **Orçamento interno de 35 minutos** em cada programa (`ARQ_ORCAMENTO_S`, padrão 2100; valor ilegível ou ≤ 0 é `bug` com o nome da variável): olhado **antes de cada download e de cada item**; ao chegar nele o programa para de pegar trabalho novo, decifra e informa o que já baixou e escreve a linha com `parcial: true`. O `decifrar` recebe o que resta do orçamento como `timeout`. O `SIGTERM` do `timeout -k 30s 40m` vira a linha `desfecho: "timeout"` (com `parcial` e as contagens) antes do `SIGKILL` | Com o `timeout` do cron como única defesa, uma execução longa morreria sem linha no registro, e o pulso veria a execução anterior (Yannis, importante 6). A seguinte continua de onde o plano disser (`02` §10.6) |
| D-F7 | **Ritmo de chamadas ao site: no máximo 90 por minuto por programa** (intervalo mínimo de 0,67 s); com `X-RateLimit-Remaining` ≤ 1 espera o `X-RateLimit-Reset` antes da chamada seguinte; `429` espera o `X-RateLimit-Reset` (ou 60 s) e segue, até 10 vezes seguidas | Limite de 100 por minuto por chave (`02` §10.6) com folga para o batimento; contrato r2, C0 ("espaça pelo Remaining e, no 429, espera o Reset e segue, sem encerrar a execução") |
| D-F8 | **A conta do orçamento acoplado:** copiador às 03:17 e 15:17 (`timeout -k 30s 40m`, orçamento interno 35 min, termina até 03:57/15:57); `conferir-b2` às 11:07 (idem, até 11:47); fila a cada 10 min com `timeout 25m`, `flock` próprio; pulso no minuto 0. Nenhum dos três divide trava, registro ou verificação; a fila não muda. O pior caso de um bloco novo do pulso é 5 tentativas de `curl` de 20 s com esperas de 10 a 50 s (cerca de 4 min 10 s por bloco, 12 min 30 s nos três), dentro da hora entre dois pulsos | Item 33; CLAUDE.md, "Orçamento acoplado" |
| D-F9 | **Hora do `conferir-b2`: 11:07 do relógio da forja (14:07 UTC), definitiva** | P26: a tarefa do NAS para o B2 do arquivo começa às 06:10 (M3a, P6), o copiador termina até 03:57 e 15:57; 11:07 fica 4 h 57 min depois do começo da cópia do NAS e 3 h 50 min antes do copiador da tarde |
| D-F10 | **Sobra em `_recebendo`:** `_recebendo/<caminho final>`, a mesma árvore (contrato C0.2); o `rename` leva ao final no mesmo filho. O `channel_ref` vem no caminho (P34). O que o site manda apagar (`a_apagar`) só é aceito se for `_recebendo/` + um caminho que o construtor remonta igual (`comum.de_recebendo`) | Contrato C0.2 |
| D-F11 | **A forja guarda a sua própria cópia das listas fechadas** (classes, tabelas, filho de cada classe, nomes reservados) e recusa item de plano fora delas (`item_recusado`, contado na linha do registro, vermelho no pulso) | `02` §10.6, "Caminho de arquivo": nada do site vira pedaço de caminho sem validação. Tabela nova no site exige commit no kit: é o comportamento desejado |
| D-F12 | **O `pode-desligar` é um subcomando do `scripts/obs-arquivo.ts`**, com a decisão numa função pura em `apps/web/src/lib/youtube/observatorio/arquivo/pode-desligar.ts` e a leitura numa única chamada de `public.obs_archive_pode_desligar(p_site)` (contrato C11, criada pelo plano do site, D18 de lá), dentro de `begin transaction read only` e `rollback` | `02` §10.10 dá o nome do comando; o molde da E10 (`cli.ts` puro, script fino) |
| D-F13 | **Alarme de 80% é do site, não do copiador:** o batimento leva `livre_bytes` **e** `total_bytes` do mesmo `statvfs` (C8 r2) e o site põe `nas_80:<filho>` em `vermelhos` (o pulso do arquivo fica vermelho pelo `plano.json`); a linha do copiador guarda `uso` e `alerta_80` por filho, mas `nas_quase_cheio` **não é desfecho** | Contrato r2.1, X4; I5 do Phil: como desfecho, o alarme ficaria aceso por semanas e cegaria a verificação da execução (um `site_fora` real não geraria aviso novo) |
| D-F14 | **O copiador grava `estado/aguardando_dono.json`** (os itens `aguardando_dono` do último plano, com `b2_file_id_bom`), e a ferramenta `restaurar_do_b2.py --do-plano` o lê | P24: o dono restaura sem copiar `fileId` à mão; o `plano.json` continua exatamente na forma da M3a |
| D-F15 | **Os blocos do pulso entram depois da primeira execução de cron de cada programa** (bloco 5 do dono, no dia seguinte ao cron), **e antes de 28/11** (a primeira selagem); o fecho da Tarefa 9 não marca a 5b no índice sem `PULSO-INSTALADO` e sem o bloco 6 com as três verificações "up" | Antes disso o bloco do copiador daria `sem-execucao` e o do B2, `jsonl-ausente`: as três verificações sairiam de "nova" direto para "fora", e o primeiro aviso ao celular seria falso. Sem prazo, nenhuma falha do arquivo tocaria o celular (I4 do Phil) |
| D-F16 | **Cada programa lê `<base>/<programa>.env` por baixo do ambiente do processo** (`comum.ambiente`); nenhum segredo mora no `.env` | A chave de API está em `chaves/` (M3a, P2) e a do B2 e a da cifra no `rclone.conf`; o `.env` só guarda chaves de comportamento, cada uma com padrão e teste |
| D-F17 | **"Baixou e não decifrou" é informado como `nao_decifra`, com o `fileId` e o `uploadTimestamp` e sem sha256** (C7.2 r2, K4): o site o trata como `divergente` já no primeiro informe, retira a atestação e acende `b2_ilegivel:<arquivo_id>`. É resultado próprio e não derruba o desfecho do `conferir-b2` (o vermelho vem do site). Canário que não decifra continua derrubando a execução (`controle_falhou`) | Contrato r2, Pedido 1 aceito (substitui a versão anterior, que informava `sem_acesso` e nunca retirava) |
| D-F18 | **A ordem do copiador é plano → batimento → canário → `attest` só com os canários → exportações → informes → reconferência → batimento final** | K3: com o batimento antes do plano, a casa que volta depois de 3 dias desligada nunca veria a varredura completa (C2 do Phil, crítico 3 do Yannis). O canário vai ao site logo depois de gravado, para um erro do site no meio não deixar o `conferir-b2` do dia sem canário (Yannis, importante 1) |
| D-F19 | **Desfechos do copiador, do mais grave para o menos:** `nas_cheio`, `controle_falhou` (canário recusado), `nas_fora`, `nas_ilegivel`, `plano_invalido`, `unidade_falhou`, `informe_recusado`, `incompleto`, `ok`; mais `arquivo_desligado`, `chave`, `site_fora` (inclusive no meio da execução, com `parcial` e `contagens`), `timeout` e `bug`. **Do `conferir-b2`:** `plano_invalido`, `sem_acesso` (algum controle ou arquivo sem acesso), `informe_recusado`, `teto_bytes`, `incompleto` (informados < pedidos, ou pediu e nenhum presente), `ok`; mais `controle_falhou`, `desligado`, `chave_ausente`, `remoto_nao_b2`, `arquivo_desligado`, `chave`, `site_fora`, `timeout`, `bug` | Contrato r2.1, C9 e X5; I1 e I2 do Phil; importantes 1, 5 e 8 do Yannis. Todo desfecho fora de `ok` é vermelho no pulso, **exceto** `teto_bytes` com `teto_cor: "ambar"` (r2.2: primeiro dia, sem alerta) |
| D-F20 | **Validade da execução do B2 (X1):** 2 h por página, renovada a cada `GET` de página; resposta `execucao_vencida` faz o `conferir-b2` pedir o plano de novo com o cursor da última página aceita e retomar dali, sem rebaixar o que já foi aceito; execução nova (outro `execucao_id`) refaz o controle negativo e os canários antes dos arquivos. **Entre execuções** (r2.2) o ponto de retomada do `--completo` é do site: a forja pede sem cursor, o plano vem retomado (`retomado_de`, `cobertura`) e a linha os guarda | Contrato r2.1, X1; r2.2 (I3 do Phil) |

## Estrutura de arquivos

Kit (`~/Workspace/forja/ferramentas`, git local):

| Arquivo | Responsabilidade |
|---|---|
| `arquivo/comum.py` | Listas fechadas, construtor e analisador de caminho, item do plano, **leitor de produção próprio** (o `csv` da 3.12 não serve: K1), `ler_arquivo` (sha256, bytes, linhas e soma numa leitura só), gravação que nunca sobrescreve, registro `.jsonl`, `plano.json`, estado das montagens, corpo do batimento (C8 r2), `SIGTERM` → `Cortado`, `.env` e configuração com padrões |
| `arquivo/teste_comum.py` | Prova o `comum.py` (itens 20, 74, 79, 131 na parte do caminho) |
| `arquivo/cliente_site.py` | Cliente do site: `X-Pipeline-Key`, ritmo, `429`, erros tipados (contrato C0) |
| `arquivo/b2.py` | Cliente da API nativa do B2, leitura do `rclone.conf` e decifrador local pelo `rclone` (D-F2) |
| `arquivo/falsos.py` | Só para os testes: site falso (segue o contrato r2.2 à risca e espelha o Zod das rotas) e B2 falso (`b2api/v4`), servidores HTTP em `127.0.0.1`, e `rclone` falso |
| `arquivo/teste_site_b2.py` | Prova `cliente_site.py` e `b2.py` |
| `arquivo/copiador/copiar.py` | O copiador (`--cron`, `--prova`, `--completo`) |
| `arquivo/teste_copiador.py` | Prova o copiador (itens 27, 30, 74, 76, 79, 134 na parte do canário, 172 na parte da forja) |
| `arquivo/conferir-b2/conferir.py` | O `conferir-b2` (`--cron`, `--prova`, `--completo`) |
| `arquivo/teste_conferir_b2.py` | Prova o `conferir-b2` (item 132, parte do kit; P59) |
| `arquivo/restaurar_do_b2.py` | Ferramenta do dono: traz a versão do `fileId` para `_recebendo/` (P24, Su1) |
| `arquivo/teste_restaurar.py` | Prova a restauração (item 172, "duas versões no B2 falso") |
| `arquivo/copiador.env.modelo`, `arquivo/conferir-b2.env.modelo` | Modelos dos `.env`, sem segredo; o do B2 nasce desligado |
| `arquivo/relogio_forja.sh` | Lê o relógio e liga o NTP se preciso (`05` §16.11 passo 5; P39) |
| `arquivo/teste_tudo.sh` | Roda todos os testes do arquivo (M3a e M3b) **no Python 3.12** e diz o total; teste que falta conta como falha |
| `arquivo/pulso_arquivo.py`, `arquivo/teste_pulso_arquivo.py` (da M3a, **alterados**) | O bloco do B2 aceita `estado: "nada_devido"` (K4) e lê `teto_bytes` pela cor do site (`teto_cor`, r2.2); o instalador lê as três URLs por `--stdin` (m2) |

Site (`~/Workspace/bythiagofigueiredo`):

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/lib/youtube/observatorio/arquivo/pode-desligar.ts` (novo) | Leitura e frases do `pode-desligar`, puras |
| `apps/web/test/youtube/observatorio/arquivo-pode-desligar.test.ts` (novo) | Item 149, parte do comando |
| `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (alterado) | Subcomando `pode-desligar` |

Arquivos de comandos do dono (`.superpowers/sdd/manutencao-nas/m3b/`, fora do git; saídas em `saidas/`):

| Arquivo | Escreve? | O que faz |
|---|---|---|
| `m3b-forja-0-antes.sh` | não | O que há na forja antes de instalar |
| `m3b-forja-1-instalar.sh` | forja | Confere o kit sem mudança e com os testes passando, copia programas e modelos, cria os `.env` com `cp -n`, grava `VERSAO`, confere o md5 |
| `m3b-forja-2-ligar-e-provar.sh` | forja (uma linha) | O teste do leitor no Python da forja, liga o `conferir-b2`, as duas provas |
| `m3b-forja-3-cron.md` | forja (`crontab -e`) | A exceção: as duas linhas do cron |
| `m3b-forja-4-registros.sh` | não | No dia seguinte: os registros de cron, o plano em disco, os canários, `_recebendo` |
| `m3b-forja-5-pulso.sh` | forja | Os três blocos do pulso (URLs digitadas na sessão) |
| `m3b-forja-6-conferencia.sh` | não | Item 33 e os registros, uma hora depois do bloco 5 |
| `m3b-relogio.sh` | forja (só se preciso, com `sudo`) | Relógio da forja |
| `m3b-casa-antes-de-desligar.sh` | não (banco, só leitura) | `pode-desligar`; pede a conexão direta sem eco (a senha nunca vai ao histórico do shell, K6) |
| `m3b-casa-conferir-b2-completo.sh` | forja (registro) | `conferir-b2 --completo` à mão |
| `m3b-casa-desligar-forja.sh` | forja (`sudo`, senha digitada) | Desliga a forja (passo 3 da mudança; K6: arquivo, não comando para colar) |
| `m3b-casa-depois-de-religar.sh` | não | Pool, chave, montagens, sentinelas, relógio, copiador |
| `m3b-casa-scrub.sh` | NAS (`sudo`, senha digitada) | O scrub do pool depois de religar (K6) |
| `m3b-restaurar.sh` | NAS (em `_recebendo`) | Restaurar do B2 pelo `fileId`, sob a trava do copiador |
| `m3b-desfazer-forja.sh` | forja | Volta atrás (depois de tirar as linhas do cron por `crontab -e`) |

---

### Task 1: `comum.py`, o que os dois programas dividem

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/comum.py`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_comum.py`

**Interfaces:**
- Consumes: contrato C0.1 (listas fechadas, filho de cada classe), C0.2 (caminhos, `arquivo_id`, `_recebendo/<caminho final>`), C0.3 (CSV); interface da M3a (chave em `chaves/<programa>.chave`, `plano.json`).
- Produces: `CLASSES`, `TABELAS`, `RESERVADOS`, `FILHOS`, `SENTINELA`, `RE_UUID`, `RE_DIA`; `CaminhoInvalido`, `CsvInvalido`, `Cortado` (o `SIGTERM`, por `instalar_sigterm()`); `versao_kit(base)`; `corpo_batimento(base, filhos, parado_no_teto, ultimo_erro)` (C8 r2, com `total_bytes`); `ler_arquivo(caminho, coluna, eh_csv) -> {sha256, bytes, linhas, soma}` (uma leitura só; erro de E/S sobe como `OSError`); `caminho_unidade(classe, canal, tabela, mes, versao, parte=None) -> (filho, rel)`; `caminho_resumo(classe, canal, mes, versao, papel)`; `caminho_manifesto(classe, mes, versao, extensao)`; `nome_recebendo(rel)`; `de_recebendo(caminho) -> rel`; `analisar(rel) -> (filho, rel) | None`; `caminho_do_item(item) -> (filho, rel)`; `ler_csv_gz(caminho, coluna) -> (linhas, soma | None)`; `linhas_csv_gz(caminho)`; `sha256_arquivo(caminho) -> (hex, bytes)`; `gravar_atomico(destino, dados, modo)` (nunca sobrescreve); `trocar_atomico(destino, dados, modo)` (estado da forja); `registrar(caminho, linha)`; `gravar_plano(caminho, vermelhos)`; `estado_filho(raiz, filho, eh_montagem)`; `alerta_80(estado)`; `config(programa, env)` (com `erro_config` quando `ARQ_ORCAMENTO_S` ou `ARQ_RITMO_S` é ilegível; o programa registra `bug`); `ambiente(programa, env)`; `carregar_env(caminho)`; `ler_chave(caminho)`; `agora_iso()`; `hoje_sp()`.

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_comum.py`:

```python
"""M3b: prova o comum.py. Uso: python3 ~/Workspace/forja/ferramentas/arquivo/teste_comum.py
Não toca na forja nem na rede."""
import gzip, json, os, stat, sys, tempfile
from datetime import datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import comum as c  # noqa: E402

falhas = []
CANAL = "0b6f3c2e-6a51-4c1e-9d0e-6f2b1a7c9e10"


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def lanca(fn, tipo):
    try:
        fn()
    except tipo:
        return True
    except Exception:
        return False
    return False


# ---------- caminhos ----------
exige(c.caminho_unidade("serie", CANAL, "competitor_video_daily", "2026-10", 1) ==
      ("numerico", "serie/canais/%s/competitor_video_daily/2026-10.v1.csv.gz" % CANAL), "unidade: classe primeiro, canal, tabela")
exige(c.caminho_unidade("texto", CANAL, "competitor_raw", "2026-10", 2, parte=3)[1].endswith("/competitor_raw/2026-10.v2.p03.csv.gz"), "parte com dois dígitos")
exige(c.caminho_unidade("video_antigo", CANAL, "competitor_raw", "2026-10", 1)[0] == "texto", "video_antigo mora em texto")
exige(c.caminho_unidade("texto", CANAL, "competitor_raw", "2026-10", 1)[1] != c.caminho_unidade("video_antigo", CANAL, "competitor_raw", "2026-10", 1)[1],
      "item 131: mesma tabela e mês em duas classes dão dois nomes")
exige(c.caminho_resumo("serie", CANAL, "2026-10", 1, "canal") == ("numerico", "serie/canais/%s/resumo/2026-10.v1.canal.csv.gz" % CANAL), "resumo por canal")
exige(lanca(lambda: c.caminho_resumo("serie", CANAL, "2026-10", 1, "ficha"), c.CaminhoInvalido), "ficha só em video_antigo")
exige(c.caminho_manifesto("horaria", "2026-10", 4, "json") == ("numerico", "horaria/manifestos/2026-10.v4.json"), "manifesto")
exige(c.caminho_manifesto("horaria", "2026-10", 4, "sha256")[1] == "horaria/manifestos/2026-10.v4.sha256", "manifesto .sha256")
for rotulo, args in (("classe fora da lista", ("arquivo", CANAL, "competitor_video_daily", "2026-10", 1)),
                     ("tabela fora da lista", ("serie", CANAL, "competitor_videos", "2026-10", 1)),
                     ("tabela reservada", ("serie", CANAL, "resumo", "2026-10", 1)),
                     ("canal não uuid", ("serie", "../etc", "competitor_video_daily", "2026-10", 1)),
                     ("canal com maiúscula", ("serie", CANAL.upper(), "competitor_video_daily", "2026-10", 1)),
                     ("mês com dia", ("serie", CANAL, "competitor_video_daily", "2026-10-01", 1)),
                     ("mês 13", ("serie", CANAL, "competitor_video_daily", "2026-13", 1)),
                     ("versão zero", ("serie", CANAL, "competitor_video_daily", "2026-10", 0)),
                     ("versão texto", ("serie", CANAL, "competitor_video_daily", "2026-10", "1")),
                     ("versão booleana", ("serie", CANAL, "competitor_video_daily", "2026-10", True))):
    exige(lanca(lambda a=args: c.caminho_unidade(*a), c.CaminhoInvalido), "recusa " + rotulo)
exige(lanca(lambda: c.caminho_unidade("serie", CANAL, "competitor_video_daily", "2026-10", 1, parte=0), c.CaminhoInvalido), "recusa parte 0")
exige(all(n not in c.CLASSES and n not in c.TABELAS for n in c.RESERVADOS), "nenhum nome reservado é classe ou tabela")
exige(set(c.CLASSES.values()) == set(c.FILHOS), "toda classe mora num dos dois filhos")
U = "serie/canais/%s/competitor_video_daily/2026-10.v1.csv.gz" % CANAL
exige(c.nome_recebendo(U) == "_recebendo/" + U, "sobra: a mesma árvore sob _recebendo (C0.2), com o channel_ref no caminho (P34)")
exige(c.de_recebendo("_recebendo/" + U) == U, "a_apagar dentro de _recebendo: aceito")
for rotulo, cam in (("fora de _recebendo", U), ("subida de pasta", "_recebendo/../" + U),
                    ("nome solto", "_recebendo/x.csv.gz"), ("tabela fora da lista", "_recebendo/" + U.replace("competitor_video_daily", "competitor_videos")),
                    ("versão com zero à esquerda", "_recebendo/" + U.replace(".v1.", ".v01."))):
    exige(lanca(lambda k=cam: c.de_recebendo(k), c.CaminhoInvalido), "a_apagar recusa " + rotulo)
for cam in (U, c.caminho_unidade("texto", CANAL, "competitor_raw", "2026-10", 2, 3)[1],
            c.caminho_resumo("video_antigo", CANAL, "2026-10", 1, "ficha")[1], c.caminho_manifesto("horaria", "2026-10", 4, "sha256")[1]):
    exige(c.analisar(cam) is not None and c.analisar(cam)[1] == cam, "analisar remonta " + cam.split("/")[-1])

# ---------- leitor de produção (item 20) ----------
TMP = tempfile.mkdtemp(prefix="comum-")


def gz(nome, texto):
    p = os.path.join(TMP, nome)
    with gzip.open(p, "wb") as f:
        f.write(texto.encode("utf-8"))
    return p


p = gz("tres.csv.gz", 'id,views,titulo\n1,,""\n2,0,x\n3,5,\n')
exige(c.ler_csv_gz(p, "views") == (3, "5"), "nulo fora da soma, 0 soma zero")
exige(c.ler_csv_gz(p, None) == (3, None), "sem coluna de soma: soma nula")
exige(c.linhas_csv_gz(p) == [["1", None, ""], ["2", "0", "x"], ["3", "5", None]], "item 20: nulo, \"\" e 0 voltam None, '' e '0'")
p = gz("grande.csv.gz", "id,views\n1,9007199254740993\n2,9007199254740993\n")
exige(c.ler_csv_gz(p, "views") == (2, "18014398509481986"), "bigint acima de 2^53 soma exato")
p = gz("aspas.csv.gz", 'id,t\n1,"a,b\n""c""\r"\n2,"x"\n')
exige(c.ler_csv_gz(p, None) == (2, None), "vírgula, aspas, \\n e \\r dentro do campo")
p = gz("sem-fim.csv.gz", "id,views\n1,2")
exige(c.ler_csv_gz(p, "views") == (1, "2"), "última linha sem fim de linha")
p = gz("so-cabecalho.csv.gz", "id,views\n")
exige(c.ler_csv_gz(p, "views") == (0, "0"), "cabeçalho sem linhas: 0 linhas, soma 0")
p = gz("uma-coluna.csv.gz", "id\n1\n\n3\n")
exige(c.ler_csv_gz(p, None) == (3, None) and c.linhas_csv_gz(p)[1] == [None], "uma coluna: linha vazia é um nulo (csv.ts)")
for rotulo, texto, col in (("campo a menos", "id,views\n1\n", "views"),
                           ("campo a mais", "id,views\n1,2,3\n", "views"),
                           ("aspas sem fechar", 'id,t\n1,"abc\n', None),
                           ("coluna de soma ausente", "id,x\n1,2\n", "views"),
                           ("soma não inteira", "id,views\n1,2.5\n", "views"),
                           ("vazio", "", None)):
    exige(lanca(lambda t=texto, k=col, r=rotulo: c.ler_csv_gz(gz(r + ".csv.gz", t), k), c.CsvInvalido), "lança " + rotulo)
# o leitor próprio (K1): o csv da biblioteca padrão não devolve None no Python 3.12 da forja
p = gz("quebra.csv.gz", 'a\n"x\ny"\n')
exige(c.linhas_csv_gz(p) == [["x\ny"]], "\\n dentro de aspas fica no campo")
p = gz("dobradas.csv.gz", 'a,b\n"1""2",\n')
exige(c.linhas_csv_gz(p) == [['1"2', None]], "aspas dobradas viram uma; vazio sem aspas no fim é nulo")
p = gz("vazio-aspas.csv.gz", 'a,b,c\n"",,""\n')
exige(c.linhas_csv_gz(p) == [["", None, ""]], "\"\" é texto vazio, vazio sem aspas é nulo")
for n_, (rotulo, texto) in enumerate((("\\r\\n no fim da linha", "a\n1\r\n"), ("\\r solto", "a,b\n1\r2,3\n"),
                      ("aspas no meio de campo sem aspas", 'a\nx"y\n'), ("lixo depois das aspas", 'a\n"x"y\n'),
                      ("linha vazia com duas colunas", "a,b\n1,2\n\n"))):
    exige(lanca(lambda t_=texto, k=n_: c.linhas_csv_gz(gz("r%d.csv.gz" % k, t_)), c.CsvInvalido), "lança " + rotulo)
p = gz("aberta.csv.gz", 'a\n"' + "x" * 10 + "\n" * 20000)
exige(lanca(lambda: c.ler_csv_gz(p, None), c.CsvInvalido), "aspas sem fechar até o fim: lança, sem retrocesso catastrófico")
v = c.ler_arquivo(gz("um-passo.csv.gz", "id,views\n1,\n"), "views", True)
exige(v == {"sha256": c.sha256_arquivo(os.path.join(TMP, "um-passo.csv.gz"))[0], "bytes": os.path.getsize(os.path.join(TMP, "um-passo.csv.gz")),
            "linhas": 1, "soma": "0"}, "ler_arquivo: sha256, bytes, linhas e soma numa leitura só (M7)")
open(os.path.join(TMP, "lixo.csv.gz"), "wb").write(b"nao e gzip" * 100)
v = c.ler_arquivo(os.path.join(TMP, "lixo.csv.gz"), "views", True)
exige(v["linhas"] is None and v["soma"] is None and v["bytes"] == 1000 and v["sha256"] == c.sha256_arquivo(os.path.join(TMP, "lixo.csv.gz"))[0],
      "ler_arquivo: CSV ilegível dá linhas e soma nulas e o sha256 do arquivo INTEIRO")
exige(c.ler_arquivo(os.path.join(TMP, "lixo.csv.gz"), None, False)["linhas"] is None, "ler_arquivo sem CSV (manifesto): só sha256 e bytes")
exige(lanca(lambda: c.ler_arquivo(os.path.join(TMP, "nao-existe.csv.gz"), None, True), OSError), "erro de E/S passa como OSError (não vira CSV inválido)")
p = os.path.join(TMP, "nao-gz.csv.gz")
open(p, "wb").write(b"id\n1\n")
exige(lanca(lambda: c.ler_csv_gz(p, None), c.CsvInvalido), "lança arquivo que não é gzip")
p = gz("campo-grande.csv.gz", "id,j\n1,\"" + "x" * 300000 + "\"\n")
exige(c.ler_csv_gz(p, None) == (1, None), "campo de 300 kB (jsonb) passa do limite padrão do csv")

# ---------- sha256 e gravação atômica ----------
p = os.path.join(TMP, "g", "a.bin")
c.gravar_atomico(p, b"abc")
exige(c.sha256_arquivo(p) == ("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", 3), "sha256 e tamanho")
exige(lanca(lambda: c.gravar_atomico(p, b"outro"), FileExistsError) and open(p, "rb").read() == b"abc", "nunca sobrescreve (item 27)")
exige([n for n in os.listdir(os.path.dirname(p)) if n != "a.bin"] == [], "sem temporário largado")

# ---------- registro ----------
reg = os.path.join(TMP, "log", "x.jsonl")
c.registrar(reg, {"modo": "cron", "desfecho": "ok"})
d = json.loads(open(reg).read().splitlines()[-1])
exige(d["desfecho"] == "ok" and datetime.fromisoformat(d["quando"]).tzinfo is not None, "linha com quando e fuso")
with open(reg, "a") as f:
    for i in range(5100):
        f.write('{"i": %d}\n' % i)
c.registrar(reg, {"modo": "cron", "desfecho": "ok"})
linhas = open(reg).read().splitlines()
exige(len(linhas) <= 4001 and json.loads(linhas[-1])["desfecho"] == "ok", "registro podado a 4000 linhas, a última preservada")

# ---------- plano em disco (interface da M3a) ----------
pl = os.path.join(TMP, "estado", "plano.json")
c.gravar_plano(pl, ["a"])
d = json.load(open(pl))
exige(d["vermelhos"] == ["a"] and datetime.fromisoformat(d["obtido_em"]).tzinfo is not None, "plano.json com obtido_em e vermelhos")
exige(lanca(lambda: c.gravar_plano(pl, None), ValueError), "vermelhos nulo não é gravado (o pulso falharia em verde com lista vazia)")
exige(json.load(open(pl))["vermelhos"] == ["a"], "plano anterior intacto depois da recusa")
c.gravar_plano(pl, [])
exige(json.load(open(pl))["vermelhos"] == [], "plano.json é trocado (temporário + rename)")

# ---------- montagens ----------
raiz = os.path.join(TMP, "mnt")
os.makedirs(os.path.join(raiz, "numerico"))
os.makedirs(os.path.join(raiz, "texto"))
e = c.estado_filho(raiz, "numerico", eh_montagem=lambda p: False)
exige(e["montado"] is False and e["sentinela"] is False and e["livre_bytes"] is None, "não montado: nada medido (disco local da forja)")
open(os.path.join(raiz, "numerico", c.SENTINELA), "w").close()
e = c.estado_filho(raiz, "numerico", eh_montagem=lambda p: False)
exige(e["sentinela"] is False, "sentinela em disco local não vale")
e = c.estado_filho(raiz, "numerico", eh_montagem=lambda p: True)
exige(e["montado"] and e["sentinela"] and e["livre_bytes"] > 0 and 0 <= e["uso"] <= 1, "montado com sentinela: mede o statvfs")
e = c.estado_filho(raiz, "texto", eh_montagem=lambda p: True)
exige(e["montado"] and e["sentinela"] is False, "a sentinela do outro filho não serve")
exige(c.alerta_80({"total_bytes": 100, "livre_bytes": 20}) is True and c.alerta_80({"total_bytes": 100, "livre_bytes": 21}) is False,
      "item 74: alerta aos 80% do que a montagem devolve")
exige(c.alerta_80({"total_bytes": None, "livre_bytes": None}) is None, "sem medida: alerta None, nunca falso")

# ---------- configuração: cada padrão com a variável apagada (item 79) ----------
cf = c.config("copiador", env={})
exige(cf["base"] == "/opt/arquivo", "ARQUIVO_BASE apagada: /opt/arquivo")
exige(cf["chave"] == "/opt/arquivo/chaves/copiador.chave", "ARQUIVO_CHAVE_ARQ apagada: chaves/copiador.chave")
exige(c.config("conferir-b2", env={})["chave"] == "/opt/arquivo/chaves/conferidor.chave", "conferir-b2 usa conferidor.chave")
exige(cf["site"] == "https://bythiagofigueiredo.com", "ARQ_SITE apagada: o site de produção")
exige(cf["escrita"] == "/mnt/arquivo/escrita", "ARQ_MONTAGEM_ESCRITA apagada: /mnt/arquivo/escrita")
exige(cf["orcamento_s"] == 2100, "ARQ_ORCAMENTO_S apagada: 2100 s")
exige(cf["ritmo_s"] == 0.67, "ARQ_RITMO_S apagada: 0,67 s entre chamadas (D-F7)")
exige(cf["log"] == "/opt/arquivo/log/copiador.jsonl" and cf["plano"] == "/opt/arquivo/estado/plano.json", "registro e plano em disco")
exige(c.config("conferir-b2", env={})["log"] == "/opt/arquivo/log/conferir-b2.jsonl", "registro do conferir-b2")
exige(c.config("copiador", env={"ARQUIVO_BASE": "/x"})["chave"] == "/x/chaves/copiador.chave", "ARQUIVO_BASE muda tudo junto")
exige(cf["erro_config"] is None, "sem variável: sem erro de configuração")
for v in ("abc", "0", "-5"):
    exige(c.config("copiador", env={"ARQ_ORCAMENTO_S": v})["erro_config"] == "config ARQ_ORCAMENTO_S",
          "ARQ_ORCAMENTO_S=%s: erro de configuração (o programa registra bug), nunca o padrão calado (m4)" % v)
exige(c.config("copiador", env={"ARQ_RITMO_S": "x"})["erro_config"] == "config ARQ_RITMO_S", "ARQ_RITMO_S ilegível: erro de configuração")
exige(c.config("copiador", env={"ARQ_RITMO_S": "0"})["erro_config"] is None, "ARQ_RITMO_S=0 vale (os testes usam)")
exige(c.config("copiador", env={"ARQ_SITE": "http://x"})["site"] == "http://x", "ARQ_SITE só para o teste")
exige(lanca(lambda: c.config("outro", env={}), ValueError), "programa desconhecido: recusa")


# ---------- item do plano (C0.2) ----------
UID = "11111111-2222-4333-8444-555555555555"
base_item = {"tipo": "unidade", "arquivo_id": "u:" + UID, "filho": "numerico", "classe": "serie",
             "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "versao": 1, "coluna_controle": "views",
             "caminho": "serie/canais/%s/competitor_video_daily/2026-10.v1.csv.gz" % CANAL}
exige(c.caminho_do_item(base_item) == ("numerico", base_item["caminho"]), "item de unidade: o caminho montado é o do site")
parte = dict(base_item, tipo="parte", arquivo_id="p:%s:02" % UID, caminho=base_item["caminho"].replace(".v1.", ".v1.p02."))
exige(c.caminho_do_item(parte)[1].endswith(".v1.p02.csv.gz"), "item de parte")
res = dict(base_item, tipo="resumo", arquivo_id="s:%s:video" % UID, tabela=None, caminho="serie/canais/%s/resumo/2026-10.v1.video.csv.gz" % CANAL)
exige(c.caminho_do_item(res)[1].endswith("resumo/2026-10.v1.video.csv.gz"), "item de resumo")
man = dict(base_item, tipo="manifesto", arquivo_id="m:serie:2026-10:v1:sha256", tabela=None, canal=None, caminho="serie/manifestos/2026-10.v1.sha256")
exige(c.caminho_do_item(man)[1] == "serie/manifestos/2026-10.v1.sha256", "item de manifesto")
for rotulo, it in (("caminho diferente", dict(base_item, caminho=base_item["caminho"].replace("v1", "v2"))),
                   ("filho trocado", dict(base_item, filho="texto")),
                   ("caminho com subida", dict(base_item, caminho="../" + base_item["caminho"])),
                   ("anexo (M10b)", dict(base_item, tipo="anexo", arquivo_id="a:" + UID)),
                   ("manifesto de outro mês", dict(man, arquivo_id="m:serie:2026-09:v1:sha256")),
                   ("sem classe", {k: v for k, v in base_item.items() if k != "classe"}),
                   ("não é objeto", "u:x")):
    exige(lanca(lambda i=it: c.caminho_do_item(i), c.CaminhoInvalido), "item recusado: " + rotulo)

# ---------- arquivo .env ----------
envf = os.path.join(TMP, "copiador.env")
open(envf, "w").write('# comentário\nARQ_SITE="http://do-arquivo"\nOBS_ARQUIVO_CONFERIR_B2=on\nlixo\n')
exige(c.carregar_env(envf) == {"ARQ_SITE": "http://do-arquivo", "OBS_ARQUIVO_CONFERIR_B2": "on"}, "lê o .env, aspas opcionais, ignora lixo")
exige(c.carregar_env(os.path.join(TMP, "nao-existe.env")) == {}, ".env ausente: vazio (cada variável tem padrão)")
exige(c.ambiente("copiador", {"ARQUIVO_BASE": TMP})["ARQ_SITE"] == "http://do-arquivo", "o .env do programa entra por baixo")
exige(c.ambiente("copiador", {"ARQUIVO_BASE": TMP, "ARQ_SITE": "http://processo"})["ARQ_SITE"] == "http://processo", "o ambiente do processo vence")

# ---------- chave (interface da M3a) ----------
ch = os.path.join(TMP, "chaves", "copiador.chave")
os.makedirs(os.path.dirname(ch))
open(ch, "w").write("forja_" + "A" * 43 + "\n")
os.chmod(ch, 0o600)
exige(c.ler_chave(ch) == "forja_" + "A" * 43, "chave 0600 no formato: lida")
os.chmod(ch, 0o644)
exige(c.ler_chave(ch) is None, "chave legível por outros: recusada")
os.chmod(ch, 0o600)
open(ch, "w").write("forja_curta\n")
exige(c.ler_chave(ch) is None and c.ler_chave(ch + ".nao") is None, "chave fora do formato ou ausente: None")

# ---------- datas ----------
exige(c.hoje_sp(datetime(2026, 11, 1, 2, 30, tzinfo=timezone.utc)) == "2026-10-31", "o dia é o de São Paulo")

print("\ncomum: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_comum.py`
Expected: `ModuleNotFoundError: No module named 'comum'`, saída 1.

- [ ] **Step 3: Escrever o `comum.py`**

`arquivo/comum.py`:

```python
"""M3b (forja): o que o copiador e o conferir-b2 dividem. Só biblioteca padrão (Python 3.12, F30; D-F1).
Importar este módulo não tem efeito colateral: não lê ambiente, não abre arquivo, não abre socket.
Spec: docs/superpowers/specs/2026-10-13-fase-manutencao-nas/02 §9.4 (árvore) e §10.6 (caminho validado)."""
import gzip, hashlib, io, json, os, re, tempfile, zlib
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Listas fechadas (02 §10.3 e §10.8). Tabela ou classe nova no site exige commit aqui (D-F11).
CLASSES = {"serie": "numerico", "horaria": "numerico", "ensaio": "numerico", "texto": "texto", "video_antigo": "texto"}
TABELAS = frozenset({
    "competitor_video_hourly", "competitor_video_daily", "competitor_video_early",
    "competitor_video_comments", "competitor_video_comment_marks", "competitor_raw", "obs_archive_rehearsal",
    "competitor_video_versions", "competitor_field_versions", "competitor_video_tier_spans",
    "competitor_video_comment_snaps", "competitor_hour_fold_log", "competitor_changes", "competitor_readings"})
RESERVADOS = frozenset({"_recebendo", "_canario", "canais", "manifestos", "resumo", "miniaturas"})
FILHOS = ("numerico", "texto")
SENTINELA = ".arquivo-vivo"
TIPOS_RESUMO = ("canal", "video", "ficha")
ALERTA_USO = 0.80
SP = ZoneInfo("America/Sao_Paulo")
RE_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
RE_MES = re.compile(r"^20[2-9][0-9]-(0[1-9]|1[0-2])$")
RE_DIA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REGISTRO_TETO, REGISTRO_FICA = 5000, 4000
CHAVE_DO_PROGRAMA = {"copiador": "copiador", "conferir-b2": "conferidor"}


class CaminhoInvalido(ValueError):
    pass


class CsvInvalido(ValueError):
    pass


class Cortado(BaseException):
    """SIGTERM do `timeout -k 30s 40m` do cron (Yannis, importante 6): o programa escreve a linha `timeout`, com
    `parcial: true` e as contagens, antes do SIGKILL. BaseException: nenhum `except Exception` do caminho a engole."""


def instalar_sigterm():
    import signal

    def _cortar(signum, frame):
        raise Cortado()
    signal.signal(signal.SIGTERM, _cortar)


def versao_kit(base):
    try:
        return open(os.path.join(base, "VERSAO"), encoding="utf-8").read().strip()[:40] or "desconhecida"
    except OSError:
        return "desconhecida"


def corpo_batimento(base, filhos, parado_no_teto=None, ultimo_erro=None):
    """C8 r2: livre e total do mesmo statvfs (o site acende `nas_80:<filho>`), `parado_no_teto` só do conferir_b2."""
    return {"versao": versao_kit(base), "hora_maquina": agora_iso(),
            "nas_ok": all(filhos[f]["montado"] and filhos[f]["sentinela"] for f in FILHOS),
            "montagens_ok": {f: filhos[f]["montado"] for f in FILHOS},
            "sentinela_ok": {f: filhos[f]["sentinela"] for f in FILHOS},
            "livre_bytes": {f: filhos[f]["livre_bytes"] for f in FILHOS},
            "total_bytes": {f: filhos[f]["total_bytes"] for f in FILHOS},
            "parado_no_teto": parado_no_teto,
            "ultimo_erro": (ultimo_erro or None) and str(ultimo_erro)[:200]}


def _inteiro_positivo(v, nome):
    if type(v) is not int or v < 1:
        raise CaminhoInvalido("%s fora do formato: %r" % (nome, v))


def _base(classe, canal, mes, versao):
    if classe not in CLASSES:
        raise CaminhoInvalido("classe fora da lista: %r" % (classe,))
    if canal is not None and not (isinstance(canal, str) and RE_UUID.match(canal)):
        raise CaminhoInvalido("canal não é uuid: %r" % (canal,))
    if not (isinstance(mes, str) and RE_MES.match(mes)):
        raise CaminhoInvalido("mês fora de AAAA-MM: %r" % (mes,))
    _inteiro_positivo(versao, "versão")


def caminho_unidade(classe, canal, tabela, mes, versao, parte=None):
    _base(classe, canal, mes, versao)
    if canal is None:
        raise CaminhoInvalido("unidade sem canal")
    if tabela not in TABELAS or tabela in RESERVADOS:
        raise CaminhoInvalido("tabela fora da lista: %r" % (tabela,))
    fim = "%s.v%d.csv.gz" % (mes, versao)
    if parte is not None:
        _inteiro_positivo(parte, "parte")
        fim = "%s.v%d.p%02d.csv.gz" % (mes, versao, parte)
    return CLASSES[classe], "%s/canais/%s/%s/%s" % (classe, canal, tabela, fim)


def caminho_resumo(classe, canal, mes, versao, tipo):
    _base(classe, canal, mes, versao)
    if canal is None or tipo not in TIPOS_RESUMO or (tipo == "ficha" and classe != "video_antigo"):
        raise CaminhoInvalido("resumo fora do contrato: %r %r" % (classe, tipo))
    return CLASSES[classe], "%s/canais/%s/resumo/%s.v%d.%s.csv.gz" % (classe, canal, mes, versao, tipo)


def caminho_manifesto(classe, mes, versao, extensao):
    _base(classe, None, mes, versao)
    if extensao not in ("json", "sha256"):
        raise CaminhoInvalido("extensão do manifesto: %r" % (extensao,))
    return CLASSES[classe], "%s/manifestos/%s.v%d.%s" % (classe, mes, versao, extensao)


def nome_recebendo(relativo):
    """Contrato C0.2: a mesma árvore sob _recebendo/ (o rename leva ao caminho final no mesmo filho).
    A sobra carrega o channel_ref porque o caminho final o carrega (P34)."""
    return "_recebendo/" + relativo


def de_recebendo(caminho):
    """Valida um caminho de sobra que o site manda apagar (a_apagar): só _recebendo/<caminho de arquivo válido>."""
    if not caminho.startswith("_recebendo/"):
        raise CaminhoInvalido("fora de _recebendo: %r" % (caminho,))
    rel = caminho[len("_recebendo/"):]
    if analisar(rel) is None:
        raise CaminhoInvalido("sobra fora da árvore: %r" % (caminho,))
    return rel


_RE_REL = re.compile(r"^(?P<classe>[a-z_]+)/(?:canais/(?P<canal>[0-9a-f-]{36})/(?:(?P<tabela>[a-z_]+)/(?P<mes>\d{4}-\d{2})\.v(?P<v>\d+)(?:\.p(?P<p>\d{2}))?\.csv\.gz"
                     r"|resumo/(?P<rmes>\d{4}-\d{2})\.v(?P<rv>\d+)\.(?P<papel>canal|video|ficha)\.csv\.gz)"
                     r"|manifestos/(?P<mmes>\d{4}-\d{2})\.v(?P<mv>\d+)\.(?P<ext>json|sha256))$")


def analisar(rel):
    """Caminho relativo -> componentes, só se remontar exatamente o mesmo caminho; senão None."""
    m = _RE_REL.match(rel)
    if not m:
        return None
    g = m.groupdict()
    try:
        if g["tabela"]:
            parte = int(g["p"]) if g["p"] else None
            f, r = caminho_unidade(g["classe"], g["canal"], g["tabela"], g["mes"], int(g["v"]), parte)
        elif g["papel"]:
            f, r = caminho_resumo(g["classe"], g["canal"], g["rmes"], int(g["rv"]), g["papel"])
        else:
            f, r = caminho_manifesto(g["classe"], g["mmes"], int(g["mv"]), g["ext"])
    except CaminhoInvalido:
        return None
    return (f, r) if r == rel else None


# Leitor próprio do formato do C0.3 (csv.ts da E10). O csv da biblioteca padrão NÃO serve no Python 3.12 da forja:
# o efeito de QUOTE_NOTNULL no LEITOR só entrou na 3.13 (sonda do Yannis em 3.12.13: o nulo volta como ""). Item 20.
# Campo entre aspas -> str (aspas dobradas viram uma); campo vazio sem aspas -> None; vírgula separa; \n fecha o
# registro; \r fora de aspas e aspas no meio de campo sem aspas -> CsvInvalido. O(bytes), em fluxo (linha a linha).
_RE_ASPAS = re.compile(r'"([^"]*(?:""[^"]*)*)"')     # laço desenrolado: sem retrocesso catastrófico em aspas sem fechar
_RE_NU = re.compile(r'[^,"\r\n]*')


def _campos(texto, num):
    if '"' not in texto:                    # caminho rápido: a quase totalidade das linhas (números e ids)
        if "\r" in texto:
            raise CsvInvalido("\\r fora de aspas no registro %d" % num)
        return [v if v != "" else None for v in texto.split(",")]
    campos, i, n = [], 0, len(texto)
    while True:
        if i < n and texto[i] == '"':
            m = _RE_ASPAS.match(texto, i)
            if not m:
                raise CsvInvalido("aspas sem fechar no registro %d" % num)
            campos.append(m.group(1).replace('""', '"'))
        else:
            m = _RE_NU.match(texto, i)
            campos.append(m.group(0) if m.group(0) != "" else None)
        i = m.end()
        if i == n:
            return campos
        if texto[i] != ",":
            raise CsvInvalido("aspas ou \\r fora de lugar no registro %d" % num)
        i += 1


def _registros(fbin):
    """Registros de um .csv.gz já aberto em binário. Erro de formato -> CsvInvalido; erro de E/S do disco
    (EIO, ESTALE) passa como OSError: quem lê decide (o copiador informa 'ilegivel', I2 do Phil)."""
    try:
        with gzip.GzipFile(fileobj=fbin, mode="rb") as g:
            f = io.TextIOWrapper(g, encoding="utf-8", newline="")
            num, acum, aspas = 0, [], 0
            for linha in f:
                acum.append(linha)
                aspas += linha.count('"')
                if aspas % 2:               # aspas abertas: o \n é do campo, o registro continua na linha seguinte
                    continue
                num += 1
                texto = "".join(acum) if len(acum) > 1 else linha
                yield _campos(texto[:-1] if texto.endswith("\n") else texto, num)
                acum, aspas = [], 0
            if acum:
                raise CsvInvalido("aspas sem fechar no fim do arquivo")
    except (gzip.BadGzipFile, EOFError, zlib.error, UnicodeDecodeError) as e:
        raise CsvInvalido("%s: %s" % (type(e).__name__, e))


def _com_cabecalho(fbin):
    r = _registros(fbin)
    try:
        cab = next(r)
    except StopIteration:
        raise CsvInvalido("arquivo sem cabeçalho")
    return cab, r


def _contar(fbin, coluna_soma):
    cab, r = _com_cabecalho(fbin)
    i = None
    if coluna_soma is not None:
        if coluna_soma not in cab:
            raise CsvInvalido("coluna de soma %r ausente do cabeçalho" % coluna_soma)
        i = cab.index(coluna_soma)
    n, total = 0, 0
    for campos in r:
        n += 1
        if len(campos) != len(cab):
            raise CsvInvalido("registro %d com %d campos; o cabeçalho tem %d" % (n + 1, len(campos), len(cab)))
        if i is not None and campos[i] is not None:
            if not re.fullmatch(r"-?\d+", campos[i]):
                raise CsvInvalido("soma: valor não inteiro no registro %d" % (n + 1))
            total += int(campos[i])
    return n, (str(total) if i is not None else None)


def linhas_csv_gz(caminho):
    with open(caminho, "rb") as f:
        cab, r = _com_cabecalho(f)
        saida = []
        for campos in r:
            if len(campos) != len(cab):
                raise CsvInvalido("registro com %d campos; o cabeçalho tem %d" % (len(campos), len(cab)))
            saida.append(campos)
        return saida


def ler_csv_gz(caminho, coluna_soma):
    """O leitor de produção (02 §10.6): conta as linhas e soma a coluna de controle (BigInt, como texto).
    Sem coluna de controle a soma é None (a tabela não tem coluna somável), nunca '0'."""
    with open(caminho, "rb") as f:
        return _contar(f, coluna_soma)


class _ComHash(io.RawIOBase):
    """Passa os bytes do arquivo adiante e soma o sha256 e o tamanho no caminho (M7 do Phil: uma leitura só pelo NFS)."""
    def __init__(self, f):
        self.f, self.h, self.n = f, hashlib.sha256(), 0

    def readable(self):
        return True

    def readinto(self, b):
        k = self.f.readinto(b)
        if k:
            self.h.update(memoryview(b)[:k])
            self.n += k
        return k

    def resto(self):
        for bloco in iter(lambda: self.f.read(1024 * 1024), b""):
            self.h.update(bloco)
            self.n += len(bloco)


def ler_arquivo(caminho, coluna_soma, eh_csv):
    """sha256, bytes, linhas e soma numa leitura só. CSV que não se lê: linhas e soma None (o sha256 já diz que não é
    o registrado; quem conclui é o site). Erro de E/S do disco: OSError, para quem chamou."""
    with open(caminho, "rb", buffering=0) as bruto:
        h = _ComHash(bruto)
        linhas = soma = None
        if eh_csv:
            try:
                linhas, soma = _contar(io.BufferedReader(h, 1024 * 1024), coluna_soma)
            except CsvInvalido:
                linhas = soma = None
        h.resto()
    return {"sha256": h.h.hexdigest(), "bytes": h.n, "linhas": linhas, "soma": soma}


def sha256_arquivo(caminho):
    h, n = hashlib.sha256(), 0
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1024 * 1024), b""):
            h.update(bloco)
            n += len(bloco)
    return h.hexdigest(), n


def _fsync_pasta(pasta):
    fd = os.open(pasta, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def gravar_atomico(destino, dados, modo=0o644):
    """Temporário na mesma pasta + fsync + link (nunca sobrescreve: FileExistsError) + fsync da pasta."""
    pasta = os.path.dirname(destino)
    os.makedirs(pasta, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", dir=pasta)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(dados)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, modo)
        os.link(tmp, destino)               # falha se o destino existe: nunca troca um arquivo pelo mesmo nome
        _fsync_pasta(pasta)
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def trocar_atomico(destino, dados, modo=0o600):
    """Para arquivos de estado da forja (plano.json, contador de bytes): temporário + rename, que troca."""
    pasta = os.path.dirname(destino)
    os.makedirs(pasta, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", dir=pasta)
    with os.fdopen(fd, "wb") as f:
        f.write(dados)
        f.flush()
        os.fsync(f.fileno())
    os.chmod(tmp, modo)
    os.replace(tmp, destino)


def agora_iso(agora=None):
    return (agora or datetime.now().astimezone()).isoformat(timespec="seconds")


def hoje_sp(agora=None):
    return (agora or datetime.now(timezone.utc)).astimezone(SP).strftime("%Y-%m-%d")


def registrar(caminho, linha):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    d = dict(linha)
    d.setdefault("quando", agora_iso())
    with open(caminho, "a", encoding="utf-8") as f:
        f.write(json.dumps(d, ensure_ascii=False, sort_keys=True) + "\n")
    with open(caminho, encoding="utf-8") as f:
        todas = f.readlines()
    if len(todas) > REGISTRO_TETO:
        trocar_atomico(caminho, "".join(todas[-REGISTRO_FICA:]).encode("utf-8"), 0o644)


def gravar_plano(caminho, vermelhos, agora=None):
    """Interface da M3a: {"obtido_em", "vermelhos"}. Vermelhos que não são lista nunca viram lista vazia."""
    if not isinstance(vermelhos, list) or not all(isinstance(v, str) for v in vermelhos):
        raise ValueError("vermelhos do plano fora do contrato: %r" % (vermelhos,))
    corpo = {"obtido_em": agora_iso(agora), "vermelhos": vermelhos}
    trocar_atomico(caminho, json.dumps(corpo, ensure_ascii=False).encode("utf-8"), 0o644)


def estado_filho(raiz_escrita, filho, eh_montagem=os.path.ismount):
    """Montado (de verdade) E com a sentinela no próprio filho. Sem os dois, nada é medido nem gravado (02 §9.4)."""
    raiz = os.path.join(raiz_escrita, filho)
    montado = bool(eh_montagem(raiz))
    sentinela = montado and os.path.isfile(os.path.join(raiz, SENTINELA))
    e = {"filho": filho, "raiz": raiz, "montado": montado, "sentinela": sentinela,
         "total_bytes": None, "livre_bytes": None, "uso": None}
    if sentinela:
        st = os.statvfs(raiz)               # o avail da montagem já desconta a quota do pai e os snapshots (M3a)
        e["total_bytes"], e["livre_bytes"] = st.f_blocks * st.f_frsize, st.f_bavail * st.f_frsize
        e["uso"] = 1 - e["livre_bytes"] / e["total_bytes"] if e["total_bytes"] else None
    return e


def alerta_80(e):
    if not e.get("total_bytes") or e.get("livre_bytes") is None:
        return None
    return (1 - e["livre_bytes"] / e["total_bytes"]) >= ALERTA_USO


def config(programa, env=None):
    if programa not in CHAVE_DO_PROGRAMA:
        raise ValueError("programa desconhecido: %r" % (programa,))
    e = os.environ if env is None else env
    base = e.get("ARQUIVO_BASE") or "/opt/arquivo"
    erro = None                         # valor ilegível nunca cai calado no padrão (m4 do Yannis): o programa registra 'bug'
    try:
        orcamento = int(e.get("ARQ_ORCAMENTO_S") or 2100)
        if orcamento <= 0:
            raise ValueError
    except ValueError:
        orcamento, erro = 2100, "config ARQ_ORCAMENTO_S"
    try:
        ritmo = float(e.get("ARQ_RITMO_S") or 0.67)
        if ritmo < 0:
            raise ValueError
    except ValueError:
        ritmo, erro = 0.67, erro or "config ARQ_RITMO_S"
    return {
        "erro_config": erro,
        "programa": programa,
        "base": base,
        "chave": e.get("ARQUIVO_CHAVE_ARQ") or os.path.join(base, "chaves", CHAVE_DO_PROGRAMA[programa] + ".chave"),
        "site": e.get("ARQ_SITE") or "https://bythiagofigueiredo.com",
        "escrita": e.get("ARQ_MONTAGEM_ESCRITA") or "/mnt/arquivo/escrita",
        "orcamento_s": orcamento,
        "ritmo_s": ritmo,
        "log": os.path.join(base, "log", programa + ".jsonl"),
        "plano": os.path.join(base, "estado", "plano.json"),
        "estado": os.path.join(base, "estado"),
    }


def ler_chave(caminho):
    """Uma linha, forja_ + 43; arquivo em 0600 (M3a). Fora disso: None (o programa sai com desfecho 'chave')."""
    try:
        if stat_aberto(caminho):
            return None
        valor = open(caminho, encoding="utf-8").read().strip()
    except OSError:
        return None
    return valor if re.fullmatch(r"forja_[A-Za-z0-9_-]{43}", valor) else None


def stat_aberto(caminho):
    return (os.stat(caminho).st_mode & 0o077) != 0


def caminho_do_item(item):
    """ItemArquivo do plano (contrato C1/C2) -> (filho, relativo), montado só com componentes validados.
    Recusa (CaminhoInvalido) se o arquivo_id, o filho ou o caminho que o site mandou forem outros (C0.2)."""
    if not isinstance(item, dict):
        raise CaminhoInvalido("item não é objeto")
    tipo, aid = item.get("tipo"), str(item.get("arquivo_id", ""))
    try:
        if tipo == "unidade" and re.fullmatch(r"u:[0-9a-f-]{36}", aid):
            f, rel = caminho_unidade(item["classe"], item["canal"], item["tabela"], item["mes"], item["versao"])
        elif tipo == "parte" and re.fullmatch(r"p:[0-9a-f-]{36}:(0[1-9]|[1-9][0-9])", aid):
            f, rel = caminho_unidade(item["classe"], item["canal"], item["tabela"], item["mes"], item["versao"], int(aid[-2:]))
        elif tipo == "resumo" and re.fullmatch(r"s:[0-9a-f-]{36}:(canal|video|ficha)", aid):
            f, rel = caminho_resumo(item["classe"], item["canal"], item["mes"], item["versao"], aid.rsplit(":", 1)[1])
        elif tipo == "manifesto" and re.fullmatch(r"m:[a-z_]+:\d{4}-\d{2}:v\d+:(json|sha256)", aid):
            _, cl, mes, v, ext = aid.split(":")
            if (cl, mes, v) != (item["classe"], item["mes"], "v%s" % item["versao"]):
                raise CaminhoInvalido("arquivo_id do manifesto difere do item")
            f, rel = caminho_manifesto(item["classe"], item["mes"], item["versao"], ext)
        else:
            raise CaminhoInvalido("tipo ou arquivo_id fora do contrato (anexo só na M10b): %r" % (aid,))
    except (KeyError, TypeError) as e:
        raise CaminhoInvalido("item incompleto: %s" % e)
    if f != item.get("filho") or rel != item.get("caminho"):
        raise CaminhoInvalido("o caminho do site difere do montado: %r" % (item.get("caminho"),))
    return f, rel


def carregar_env(caminho):
    """KEY=VALUE por linha (aspas opcionais), # comenta. Ausente: {} (cada variável tem padrão e teste)."""
    d = {}
    try:
        linhas = open(caminho, encoding="utf-8").read().splitlines()
    except OSError:
        return d
    for l in linhas:
        m = re.match(r'^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*?)"?\s*$', l)
        if m and not l.lstrip().startswith("#"):
            d[m.group(1)] = m.group(2)
    return d


def ambiente(programa, env=None):
    """O arquivo <base>/<programa>.env por baixo, o ambiente do processo por cima (o explícito vence)."""
    e = dict(os.environ if env is None else env)
    base = e.get("ARQUIVO_BASE") or "/opt/arquivo"
    return {**carregar_env(e.get("ARQ_ENV") or os.path.join(base, programa + ".env")), **e}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_comum.py | tail -1`
Expected: `comum: 0 falha(s)`.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/comum.py arquivo/teste_comum.py
git -C $K commit -m "feat: arquivo M3b, comum.py (listas fechadas, caminho validado, leitor CSV próprio para o Python 3.12, gravação que nunca sobrescreve)" -- arquivo/comum.py arquivo/teste_comum.py
```

---

### Task 2: o cliente do site, o cliente do B2 e os falsos

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/cliente_site.py`, `arquivo/b2.py`, `arquivo/falsos.py`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_site_b2.py`

**Interfaces:**
- Consumes: contrato C0 (base `/api/pipeline/archive/`, `X-Pipeline-Key`, envelope `{"data"}`/`{"error": {"code"}}`, `503 arquivo_desligado`, `429` pelo status); remotos `b2arq:` e `arq:` da M3a (Tarefa 5 de lá).
- Produces: `cliente_site.Site(base, chave, intervalo, ...)` com `pedir(metodo, rota, corpo, consulta) -> Resposta` e `dados(...) -> data` (espaça pelo `X-RateLimit-Remaining`; no `429` espera o `X-RateLimit-Reset` e segue; `IncompleteRead` vira `SiteFora`); erros `SiteFora`, `ArquivoDesligado`, `ChaveRecusada`, `Recusa(status, code)`. `b2.RCLONES`, `b2.rclone_padrao(env) -> caminho` (`ARQ_RCLONE`, senão o primeiro de `/usr/local/bin/rclone` e `/usr/bin/rclone`); `b2.remotos(rclone, env) -> {conta, chave, bucket, prefixo, senha, senha2}` ou `ConfigB2(motivo)` com `chave_ausente` ou `remoto_nao_b2`; `b2.nome_b2(conf, filho, rel, sufixo)`; `b2.B2(...).autorizar()` (`b2api/v4`; guarda `conta_id`), `.versoes(nome)`, `.atual(nome)` (pula `start`), `.baixar(file_id, destino, restante) -> (bytes, nome)` (confere o `X-Bz-Content-Sha1` quando vem); `ErroB2(motivo, status)`, `TetoDeBytes`; `b2.decifrar(rclone, conf, pasta_cifrada, relativos, pasta_saida, sufixo, env, timeout) -> {rel: bool}`. `falsos.Servidor`, `falsos.B2Falso(bucket, restrita)`, `falsos.rclone_falso`, `falsos.dump_bom`, `falsos.cifrar`, `falsos.gz`, `falsos.sha`, `falsos.json_resp`.

**O que acontece quando o dado não existe:** nome ausente no B2 é uma listagem 200 sem versão viva (a única ausência; `hide` mais nova conta como ausente, `start` é pulada e só `start` é `ErroB2`); B2 fora, 401, 5xx, corpo ilegível ou leitura curta são `ErroB2` (o programa informa `sem_acesso`, que não retira nada). `rclone.conf` ausente ou sem o `crypt` é `chave_ausente`; `crypt` sobre outra coisa que não o `b2arq:` é `remoto_nao_b2` (recusa rodar: "apontado para a montagem do NAS não atesta", item 132).

- [ ] **Step 1: Escrever os falsos e o teste que falha**

`arquivo/falsos.py` (a classe `SiteArquivoFalso` entra na Tarefa 3):

```python
"""M3b (forja), SÓ PARA TESTE: site falso e B2 falso (servidores HTTP de verdade em 127.0.0.1) e um rclone falso.
A 'cifra' do rclone falso é um cabeçalho com a senha: decifrar com outra senha falha, como no crypt de verdade."""
import base64, gzip, hashlib, json, os, re, threading, time, urllib.parse
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CABECA = b"CIFRA:"


def cifrar(senha, dados):
    return CABECA + senha.encode() + b"\n" + dados


def gz(texto):
    return gzip.compress(texto.encode("utf-8"), mtime=0)


def sha(b):
    return hashlib.sha256(b).hexdigest()


class Servidor:
    """handler(metodo, caminho, consulta, cabecalhos, corpo) -> (status, cabecalhos, corpo)."""
    def __init__(self, handler):
        self.pedidos = []
        dono = self

        class H(BaseHTTPRequestHandler):
            def _um(self, metodo):
                u = urllib.parse.urlsplit(self.path)
                n = int(self.headers.get("Content-Length") or 0)
                corpo = self.rfile.read(n) if n else b""
                consulta = dict(urllib.parse.parse_qsl(u.query))
                dono.pedidos.append((metodo, u.path, consulta, dict(self.headers), corpo))
                status, cab, saida = handler(metodo, u.path, consulta, dict(self.headers), corpo)
                self.send_response(status)
                for k, v in cab.items():
                    self.send_header(k, v)
                self.send_header("Content-Length", str(len(saida)))
                self.end_headers()
                self.wfile.write(saida)

            def do_GET(self):
                self._um("GET")

            def do_POST(self):
                self._um("POST")

            def log_message(self, *a):
                pass

        self.http = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = "http://127.0.0.1:%d" % self.http.server_address[1]
        threading.Thread(target=self.http.serve_forever, daemon=True).start()

    def parar(self):
        self.http.shutdown()
        self.http.server_close()


def json_resp(status, d, cab=None):
    return status, dict({"Content-Type": "application/json"}, **(cab or {})), json.dumps(d).encode()


class B2Falso:
    """Objetos por nome, versões da mais nova para a mais antiga: {"fileId", "dados", "ts", "action"}.
    Fala só b2api/v4 (a v2 responde 400). O accountId da autorização ("conta-acc") é diferente do keyId ("acc"), e
    b2_list_buckets recusa o keyId no lugar dele. restrita=False: chave sem lista de buckets (vai por b2_list_buckets).
    cota_downloads: quantos downloads passam antes do 403 download_cap_exceeded; atraso: segundos por download."""
    def __init__(self, bucket="arq-bucket", restrita=True):
        self.bucket, self.objetos, self.fora, self.fora_download, self.conta_id = bucket, {}, False, False, "conta-acc"
        self.restrita, self.cota_downloads, self.atraso, self.downloads = restrita, None, 0.0, 0
        self._n = 0
        self.srv = Servidor(self._h)
        self.url = self.srv.url

    def novo_id(self):
        self._n += 1
        return "4_z%024x_f%03x_d20261014_m110700_c000_v0001_t%04d" % (self._n, 1, self._n)

    def por(self, nome, dados, ts=1760000000000, action="upload"):
        v = {"fileId": self.novo_id(), "dados": dados, "ts": ts, "action": action}
        self.objetos.setdefault(nome, []).insert(0, v)
        return v["fileId"]

    def _h(self, metodo, caminho, consulta, cab, corpo):
        if self.fora:
            return json_resp(503, {"code": "service_unavailable"})
        if "/b2api/v4/" not in caminho:
            return json_resp(400, {"code": "bad_request", "message": "só v4"})
        if caminho.endswith("b2_authorize_account"):
            baldes = [{"id": "bid", "name": self.bucket}] if self.restrita else []
            return json_resp(200, {"accountId": self.conta_id, "authorizationToken": "tok", "apiInfo": {"storageApi": {
                "apiUrl": self.url, "downloadUrl": self.url, "allowed": {"buckets": baldes, "capabilities": ["listFiles", "readFiles"], "namePrefix": None}}}})
        if cab.get("Authorization") != "tok":
            return json_resp(401, {"code": "unauthorized"})
        if caminho.endswith("b2_list_buckets"):
            q = json.loads(corpo)
            if q.get("accountId") != self.conta_id:
                return json_resp(401, {"code": "unauthorized", "message": "accountId errado"})
            return json_resp(200, {"buckets": [{"bucketId": "bid", "bucketName": self.bucket}] if q.get("bucketName") == self.bucket else []})
        if caminho.endswith("b2_list_file_versions"):
            q = json.loads(corpo)
            files = []
            for nome in sorted(self.objetos):
                if nome.startswith(q["prefix"]) and nome >= q["startFileName"]:
                    files += [{"fileName": nome, "fileId": v["fileId"], "uploadTimestamp": v["ts"], "action": v["action"],
                               "contentLength": len(v["dados"])} for v in self.objetos[nome]]
            return json_resp(200, {"files": files[:q["maxFileCount"]], "nextFileName": None, "nextFileId": None})
        if caminho.endswith("b2_download_file_by_id"):
            if self.fora_download:
                return json_resp(500, {"code": "internal"})
            if self.cota_downloads is not None and self.downloads >= self.cota_downloads:
                return json_resp(403, {"code": "download_cap_exceeded"})
            self.downloads += 1
            if self.atraso:
                time.sleep(self.atraso)
            for nome, vs in self.objetos.items():
                for v in vs:
                    if v["fileId"] == consulta.get("fileId") and v["action"] == "upload":
                        return 200, {"x-bz-file-name": urllib.parse.quote(nome), "X-Bz-Content-Sha1": hashlib.sha1(v["dados"]).hexdigest(),
                                     "Content-Type": "application/octet-stream"}, v["dados"]
            return json_resp(404, {"code": "not_found"})
        return json_resp(400, {"code": "bad_request"})


RCLONE_FALSO = r'''#!/usr/bin/env python3
import json, os, sys
log = os.environ.get("FALSO_RCLONE_LOG")
if log:
    open(log, "a").write(" ".join(sys.argv[1:]) + "\n")
a = sys.argv[1:]
if a[:2] == ["config", "dump"]:
    p = os.environ.get("FALSO_RCLONE_DUMP")
    if not p or not os.path.exists(p):
        sys.exit(1)
    sys.stdout.write(open(p).read())
    sys.exit(0)
raiz, senha = os.environ["RCLONE_CONFIG_ARQLOCAL_REMOTE"], os.environ["RCLONE_CONFIG_ARQLOCAL_PASSWORD"]
suf = os.environ.get("RCLONE_CONFIG_ARQLOCAL_SUFFIX", ".bin")
cab = b"CIFRA:" + senha.encode() + b"\n"
def um(rel):
    try:
        d = open(os.path.join(raiz, rel + suf), "rb").read()
    except OSError:
        return None
    return d[len(cab):] if d.startswith(cab) else None
if a[0] == "cat":
    d = um(a[1].split(":", 1)[1])
    if d is None:
        sys.stderr.write("ERROR : failed to authenticate decrypted block - bad password?\n")
        sys.exit(1)
    sys.stdout.buffer.write(d)
    sys.exit(0)
if a[0] == "copy":
    destino, lista = a[2], a[a.index("--files-from") + 1]
    ruim = 0
    for rel in open(lista).read().split():
        alvo = os.path.join(destino, rel)
        os.makedirs(os.path.dirname(alvo), exist_ok=True)
        d = um(rel)
        open(alvo, "wb").write(d if d is not None else b"lixo de escrita parcial")
        ruim += d is None
    sys.exit(1 if ruim else 0)
sys.exit(2)
'''


def rclone_falso(pasta, dump):
    """Grava o rclone falso e o dump; devolve (caminho do rclone, env com as variáveis do falso)."""
    os.makedirs(pasta, exist_ok=True)
    p = os.path.join(pasta, "rclone")
    with open(p, "w") as f:
        f.write(RCLONE_FALSO)
    os.chmod(p, 0o755)
    d = os.path.join(pasta, "dump.json")
    if dump is not None:
        with open(d, "w") as f:
            json.dump(dump, f)
    return p, {"FALSO_RCLONE_DUMP": d, "FALSO_RCLONE_LOG": os.path.join(pasta, "rclone.log")}


def dump_bom(b2url_bucket="arq-bucket", senha="s3nh4"):
    return {"arq": {"type": "crypt", "remote": "b2arq:%s/site-arquivo" % b2url_bucket, "filename_encryption": "off",
                    "directory_name_encryption": "false", "password": senha, "password2": "sal"},
            "b2arq": {"type": "b2", "account": "acc", "key": "k3y"}}
```

`arquivo/teste_site_b2.py`:

```python
"""M3b: prova cliente_site.py e b2.py contra servidores falsos em 127.0.0.1 e um rclone falso. Uso: python3 teste_site_b2.py"""
import json, os, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import b2 as B  # noqa: E402
import falsos as F  # noqa: E402
from cliente_site import ArquivoDesligado, ChaveRecusada, Recusa, Site, SiteFora  # noqa: E402

falhas = []


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def lanca(fn, tipo):
    try:
        fn()
    except tipo:
        return True
    except Exception as e:
        print("     (lançou %s: %s)" % (type(e).__name__, e))
        return False
    return False


# ---------- cliente_site.py ----------
fila = []
srv = F.Servidor(lambda m, c, q, h, b: fila.pop(0))
dormiu = []
s = Site(srv.url, "forja_" + "a" * 43, intervalo=0, dormir=dormiu.append)
fila.append(F.json_resp(200, {"data": {"x": 1}}))
exige(s.dados("GET", "plan", consulta={"fonte": "b2"}) == {"x": 1}, "200 devolve data")
m, cam, q, cab, _ = srv.pedidos[-1]
exige(cam == "/api/pipeline/archive/plan" and q == {"fonte": "b2"} and cab.get("X-Pipeline-Key") == "forja_" + "a" * 43, "rota, consulta e X-Pipeline-Key")
fila.append(F.json_resp(503, {"error": {"code": "arquivo_desligado", "message": "arquivo desligado"}}))
exige(lanca(lambda: s.dados("GET", "plan"), ArquivoDesligado), "503 arquivo_desligado: desfecho próprio, nunca lista vazia")
fila.append(F.json_resp(503, {"error": {"code": "outro"}}))
exige(lanca(lambda: s.dados("GET", "plan"), SiteFora), "503 de outro código: site fora")
fila.append(F.json_resp(504, {"error": {"code": "tempo_esgotado"}}))
exige(lanca(lambda: s.dados("GET", "plan"), SiteFora), "504: site fora")
fila.append(F.json_resp(403, {"error": {"code": "FORBIDDEN"}}))
exige(lanca(lambda: s.dados("GET", "plan"), ChaveRecusada), "403: chave recusada")
fila.append(F.json_resp(409, {"error": {"code": "canal_removido", "message": "x"}}))
try:
    s.dados("POST", "unit/export", {"a": 1})
    exige(False, "409 vira Recusa com o code")
except Recusa as e:
    exige(e.status == 409 and e.code == "canal_removido", "409 vira Recusa com o code")
fila += [F.json_resp(429, {"error": {"code": "UNAUTHORIZED"}}, {"X-RateLimit-Reset": "7", "Retry-After": "3"}), F.json_resp(200, {"data": 2})]
exige(s.dados("GET", "plan") == 2 and 7.0 in dormiu, "429: decide pelo status, espera o X-RateLimit-Reset e segue (C0 r2)")
fila += [F.json_resp(429, {"error": {}})] * 11
exige(lanca(lambda: s.dados("GET", "plan"), SiteFora), "429 onze vezes seguidas: site fora (não marca nada)")
dormiu.clear()
fila += [F.json_resp(200, {"data": 3}, {"X-RateLimit-Remaining": "1", "X-RateLimit-Reset": "9"}), F.json_resp(200, {"data": 4})]
exige(s.dados("GET", "plan") == 3 and dormiu == [] and s.dados("GET", "plan") == 4 and dormiu == [9.0],
      "X-RateLimit-Remaining no fim: espera o Reset ANTES da chamada seguinte, sem 429 (C0 r2)")
fila.append((200, {"Content-Type": "application/json"}, b"[1]"))
exige(lanca(lambda: s.dados("GET", "plan"), Exception), "corpo sem data: erro de forma, nunca lista vazia")
try:
    fila.append(F.json_resp(500, {"error": {"code": "erro_do_banco"}}))
    s.dados("GET", "plan")
except SiteFora as e:
    exige("forja_" not in str(e), "a chave nunca aparece na mensagem de erro")
srv.parar()
exige(lanca(lambda: Site(srv.url, "k", intervalo=0, timeout=2).dados("GET", "plan"), SiteFora), "site desligado: SiteFora (rede)")
t = [0.0]
pausas = []
s2 = Site("http://127.0.0.1:9", "k", intervalo=0.67, dormir=lambda x: (pausas.append(x), t.__setitem__(0, t[0] + x)), relogio=lambda: t[0])
s2._ritmo()
s2._ritmo()
exige(pausas and abs(pausas[0] - 0.67) < 1e-9, "ritmo: 0,67 s entre chamadas (no máximo ~90 por minuto, D-F7)")

# ---------- b2.py: remotos ----------
TMP = tempfile.mkdtemp(prefix="b2-")
rc, envf = F.rclone_falso(os.path.join(TMP, "bin"), F.dump_bom())
env = dict(os.environ, **envf)
r = B.remotos(rc, env)
exige((r["bucket"], r["prefixo"], r["senha"]) == ("arq-bucket", "site-arquivo", "s3nh4"), "remotos: bucket, prefixo e senha do crypt")
for rotulo, dump, motivo in (("sem crypt", {"b2arq": F.dump_bom()["b2arq"]}, "chave_ausente"),
                             ("crypt sem senha", {**F.dump_bom(), "arq": {**F.dump_bom()["arq"], "password": ""}}, "chave_ausente"),
                             ("crypt sobre outro remoto", {**F.dump_bom(), "arq": {**F.dump_bom()["arq"], "remote": "nas:/mnt/fast"}}, "remoto_nao_b2"),
                             ("b2arq não é b2", {**F.dump_bom(), "b2arq": {"type": "local"}}, "remoto_nao_b2"),
                             ("nome cifrado", {**F.dump_bom(), "arq": {**F.dump_bom()["arq"], "filename_encryption": "standard"}}, "remoto_nao_b2")):
    rc2, e2 = F.rclone_falso(os.path.join(TMP, rotulo.replace(" ", "-")), dump)
    try:
        B.remotos(rc2, dict(os.environ, **e2))
        exige(False, "remotos recusa " + rotulo)
    except B.ConfigB2 as e:
        exige(e.motivo == motivo, "remotos recusa %s (%s)" % (rotulo, motivo))
rc3, e3 = F.rclone_falso(os.path.join(TMP, "sem-conf"), None)
exige(lanca(lambda: B.remotos(rc3, dict(os.environ, **e3)), B.ConfigB2), "sem rclone.conf: chave_ausente")
exige(lanca(lambda: B.remotos("/nao/existe/rclone", env), B.ConfigB2), "sem rclone: chave_ausente")
exige(B.nome_b2(r, "numerico", "_canario/2026-10-14", ".bin") == "site-arquivo/numerico/_canario/2026-10-14.bin", "nome no B2 (D-F3)")

# ---------- b2.py: rclone do cron (Yannis, importante 7; item 79) ----------
bom = os.path.join(TMP, "usr-local-rclone")
open(bom, "w").write("#!/bin/sh\n")
os.chmod(bom, 0o755)
exige(B.rclone_padrao({}, (os.path.join(TMP, "nao-existe"), bom)) == bom, "ARQ_RCLONE apagada: o primeiro executável da lista (/usr/local/bin antes de /usr/bin)")
exige(B.rclone_padrao({}, (os.path.join(TMP, "nao-existe"),)) == "rclone", "nenhum na lista: o do PATH")
exige(B.rclone_padrao({"ARQ_RCLONE": "/x/rclone"}) == "/x/rclone", "ARQ_RCLONE manda")
exige(B.RCLONES == ("/usr/local/bin/rclone", "/usr/bin/rclone"), "a lista de produção")

# ---------- b2.py: listagem, ausência e download ----------
fb = F.B2Falso()
cli = B.B2("acc", "k3y", "arq-bucket", base=fb.url, banda_bps=None).autorizar()
exige(cli.conta_id == "conta-acc" and cli.bucket_id == "bid", "v4: accountId da resposta (não o keyId) e o bucket da lista allowed.buckets")
fb2 = F.B2Falso(restrita=False)
exige(B.B2("acc", "k3y", "arq-bucket", base=fb2.url).autorizar().bucket_id == "bid", "chave sem lista de buckets: b2_list_buckets com o accountId da autorização")
exige(lanca(lambda: B.B2("acc", "k3y", "outro", base=fb2.url).autorizar(), B.ErroB2), "b2_list_buckets sem o bucket: erro")
fb2.srv.parar()
n1 = "site-arquivo/numerico/serie/x.csv.gz.bin"
id_velho = fb.por(n1, b"velho", ts=1)
id_novo = fb.por(n1, b"novo", ts=2)
fb.por(n1 + ".outro", b"vizinho")
exige([v["fileId"] for v in cli.versoes(n1)] == [id_novo, id_velho], "versões do nome exato, da mais nova para a mais antiga (sem o vizinho)")
exige(cli.atual(n1)["fileId"] == id_novo, "atual: a mais nova")
exige(cli.versoes("site-arquivo/nao-existe") == [] and cli.atual("site-arquivo/nao-existe") is None, "não existe: lista vazia numa resposta 200")
fb.por("escondido", b"", action="hide")
exige(cli.atual("escondido") is None, "escondido conta como ausente")
id_up = fb.por("grande", b"subiu")
fb.por("grande", b"", action="start")
exige(cli.atual("grande")["fileId"] == id_up, "versão start (envio em curso) mais nova sobre uma upload: a upload (C7.2 r2)")
fb.por("so-start", b"", action="start")
exige(lanca(lambda: cli.atual("so-start"), B.ErroB2), "só versão start: erro (sem_acesso), nunca ausente nem presente")
destino = os.path.join(TMP, "d", "x")
exige(cli.baixar(id_velho, destino, 10**9) == (5, n1) and open(destino, "rb").read() == b"velho", "baixa pelo fileId a versão pedida, não a atual")
try:
    cli.baixar("4_z" + "0" * 24 + "_f001_naoexiste", destino, 10**9)
    exige(False, "fileId que não existe: ErroB2 com status 404")
except B.ErroB2 as e:
    exige(e.status == 404, "fileId que não existe: ErroB2 com status 404 (a restauração diz SEM-VERSAO-BOA-NO-B2)")
exige(lanca(lambda: cli.baixar(id_novo, destino, 2), B.TetoDeBytes), "teto de bytes: para antes de passar")
exige(lanca(lambda: cli.baixar("../../x", destino, 10**9), B.ErroB2), "fileId fora do formato: recusa sem pedir")
fb.fora = True
exige(lanca(lambda: cli.versoes(n1), B.ErroB2), "B2 fora do ar: erro (sem_acesso), NUNCA lista vazia")
exige(lanca(lambda: B.B2("acc", "k3y", "arq-bucket", base=fb.url).autorizar(), B.ErroB2), "autorização com B2 fora: erro")
fb.fora = False
exige(lanca(lambda: B.B2("acc", "k3y", "outro-bucket", base=fb.url).autorizar(), B.ErroB2), "chave de outro bucket: erro")
t = [0.0]
pausas = []
lento = B.B2("acc", "k3y", "arq-bucket", base=fb.url, banda_bps=2, dormir=lambda x: (pausas.append(x), t.__setitem__(0, t[0] + x)), relogio=lambda: t[0]).autorizar()
lento.baixar(id_velho, destino + "2", 10**9)
exige(sum(pausas) >= 2.4, "limite de banda no programa (P32): 5 bytes a 2 B/s esperam ~2,5 s")
fb.srv.parar()

# ---------- b2.py: decifrar ----------
cif, out = os.path.join(TMP, "cif"), os.path.join(TMP, "out")
for rel, senha in (("a/um.csv.gz", "s3nh4"), ("a/dois.csv.gz", "s3nh4")):
    os.makedirs(os.path.dirname(os.path.join(cif, rel)), exist_ok=True)
    open(os.path.join(cif, rel + ".bin"), "wb").write(F.cifrar(senha, b"conteudo " + rel.encode()))
res = B.decifrar(rc, r, cif, ["a/um.csv.gz", "a/dois.csv.gz"], out, ".bin", env)
exige(res == {"a/um.csv.gz": True, "a/dois.csv.gz": True} and open(os.path.join(out, "a/um.csv.gz"), "rb").read() == b"conteudo a/um.csv.gz",
      "decifra o lote numa chamada só (P37)")
exige("RCLONE_CONFIG" not in open(envf["FALSO_RCLONE_LOG"]).read() and "s3nh4" not in open(envf["FALSO_RCLONE_LOG"]).read(),
      "a senha nunca vai para a linha de comando")
open(os.path.join(cif, "a/dois.csv.gz.bin"), "wb").write(F.cifrar("errada", b"x"))
out2 = os.path.join(TMP, "out2")
res = B.decifrar(rc, r, cif, ["a/um.csv.gz", "a/dois.csv.gz"], out2, ".bin", env)
exige(res == {"a/um.csv.gz": True, "a/dois.csv.gz": False}, "lote com um que não decifra: um por arquivo diz qual")
exige(not os.path.exists(os.path.join(out2, "a/dois.csv.gz")), "o que não decifrou não fica no disco (nem o lixo do lote)")

print("\nsite e b2: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_site_b2.py`
Expected: `ModuleNotFoundError: No module named 'b2'`, saída 1.

- [ ] **Step 3: Escrever os dois clientes**

`arquivo/cliente_site.py`:

```python
"""M3b (forja): cliente do site para os programas do arquivo (contrato C0). Só biblioteca padrão (D-F1).
Decide pelo status e pelo `code` do envelope; nunca põe a chave em mensagem de erro."""
import http.client, json, time, urllib.error, urllib.parse, urllib.request

ROTA = "/api/pipeline/archive/"


class ErroDoSite(Exception):
    def __init__(self, status, code, mensagem=""):
        super().__init__("%s %s %s" % (status, code, mensagem[:200]))
        self.status, self.code, self.mensagem = status, code, mensagem


class SiteFora(ErroDoSite):          # rede, tempo, 5xx, 429 que não passou: tenta na execução seguinte, não marca nada
    pass


class ArquivoDesligado(ErroDoSite):  # 503 arquivo_desligado: desfecho próprio, nunca lista vazia (C0)
    pass


class ChaveRecusada(ErroDoSite):     # 401 e 403
    pass


class Recusa(ErroDoSite):            # 4xx com código da rota (409, 413, 422, 400)
    pass


class Resposta:
    def __init__(self, status, cabecalhos, corpo):
        self.status, self.cabecalhos, self.corpo = status, {k.lower(): v for k, v in cabecalhos.items()}, corpo

    def json(self):
        return json.loads(self.corpo.decode("utf-8"))


def _code(corpo):
    try:
        e = json.loads(corpo.decode("utf-8")).get("error") or {}
        return str(e.get("code") or ""), str(e.get("message") or "")
    except Exception:
        return "", ""


class Site:
    def __init__(self, base, chave, intervalo=0.67, timeout=60, tentativas_429=10, dormir=time.sleep, relogio=time.monotonic):
        self.base, self._chave, self.intervalo, self.timeout = base.rstrip("/"), chave, intervalo, timeout
        self.tentativas_429, self.dormir, self.relogio = tentativas_429, dormir, relogio
        self._ultima, self.chamadas, self._restam, self._zera = None, 0, None, None

    @staticmethod
    def _segundos(v, padrao):
        try:
            return min(max(float(v), 1.0), 120.0)
        except (TypeError, ValueError):
            return padrao

    def _ritmo(self):
        if self._restam is not None and self._restam <= 1:      # C0 r2: espaça pelo X-RateLimit-Remaining
            self.dormir(self._segundos(self._zera, 60.0))
            self._restam = None
        if self._ultima is not None:
            falta = self.intervalo - (self.relogio() - self._ultima)
            if falta > 0:
                self.dormir(falta)
        self._ultima = self.relogio()

    def _limite(self, cab):
        cab = {k.lower(): v for k, v in cab.items()}
        try:
            self._restam = int(cab["x-ratelimit-remaining"])
        except (KeyError, TypeError, ValueError):
            self._restam = None
        self._zera = cab.get("x-ratelimit-reset")

    def pedir(self, metodo, rota, corpo=None, consulta=None):
        url = self.base + ROTA + rota + ("?" + urllib.parse.urlencode(consulta) if consulta else "")
        dados = None if corpo is None else json.dumps(corpo).encode("utf-8")
        for tentativa in range(self.tentativas_429 + 1):
            self._ritmo()
            self.chamadas += 1
            req = urllib.request.Request(url, data=dados, method=metodo, headers={"X-Pipeline-Key": self._chave, "Accept": "*/*"})
            if dados is not None:
                req.add_header("Content-Type", "application/json")
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    self._limite(dict(r.headers))
                    return Resposta(r.status, dict(r.headers), r.read())
            except urllib.error.HTTPError as e:
                try:
                    status, cab, bruto = e.code, dict(e.headers or {}), e.read()
                except (OSError, http.client.HTTPException) as e2:
                    raise SiteFora(e.code, "rede", type(e2).__name__)
            except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as e:
                raise SiteFora(0, "rede", type(e).__name__)        # IncompleteRead é HTTPException, não OSError (m1)
            self._limite(cab)
            code, msg = _code(bruto)
            if status == 429:                   # C0: decide pelo status, nunca pelo code; espera o Reset e segue (r2)
                if tentativa == self.tentativas_429:
                    raise SiteFora(429, "limite", msg)
                c = {k.lower(): v for k, v in cab.items()}
                self.dormir(self._segundos(c.get("x-ratelimit-reset") or c.get("retry-after"), 60.0))
                self._restam = None
                continue
            if status == 503 and code == "arquivo_desligado":
                raise ArquivoDesligado(status, code, msg)
            if status >= 500:
                raise SiteFora(status, code or "5xx", msg)
            if status in (401, 403):
                raise ChaveRecusada(status, code, msg)
            raise Recusa(status, code, msg)
        raise SiteFora(429, "limite", "")

    def dados(self, metodo, rota, corpo=None, consulta=None):
        r = self.pedir(metodo, rota, corpo, consulta)
        try:
            d = r.json()
        except Exception:
            raise ErroDoSite(r.status, "forma", "corpo não é JSON")
        if not isinstance(d, dict) or "data" not in d:
            raise ErroDoSite(r.status, "forma", "sem data")
        return d["data"]
```

`arquivo/b2.py`:

```python
"""M3b (forja): a API nativa do B2 (D-F2) e o decifrador local pelo rclone. Só biblioteca padrão.
'Não existe' é lista vazia numa resposta 200; todo o resto é ErroB2 (sem_acesso): nunca ausência por erro.
API b2api/v4 (conferida na documentação oficial da Backblaze em 14/10: b2_authorize_account devolve accountId e
apiInfo.storageApi.{apiUrl, downloadUrl, allowed.buckets[{id, name}]}; a v2 é legado e não serve chave multibucket)."""
import base64, hashlib, http.client, json, os, re, subprocess, tempfile, time, urllib.error, urllib.parse, urllib.request

RE_FILE_ID = re.compile(r"^4_z[0-9a-f]{24}_f[0-9a-f]{3}_[0-9a-z_]+$")


class ErroB2(Exception):
    def __init__(self, motivo, status=None):
        super().__init__(motivo)
        self.status = status            # status HTTP, quando houve um (404 do fileId atestado: M4 do Phil)


class TetoDeBytes(Exception):
    pass


class ConfigB2(Exception):
    """motivo: 'chave_ausente' (sem o remoto crypt) ou 'remoto_nao_b2' (o de baixo não é b2)."""
    def __init__(self, motivo):
        super().__init__(motivo)
        self.motivo = motivo


RCLONES = ("/usr/local/bin/rclone", "/usr/bin/rclone")


def rclone_padrao(env=None, candidatos=RCLONES):
    """Yannis, importante 7: o cron tem PATH=/usr/bin:/bin e acharia o rclone 1.60 do apt; a M3a instala o bom em
    /usr/local/bin. ARQ_RCLONE manda; sem ela, o primeiro executável da lista; sem nenhum, 'rclone' (o PATH)."""
    e = os.environ if env is None else env
    if e.get("ARQ_RCLONE"):
        return e["ARQ_RCLONE"]
    for c in candidatos:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return "rclone"


def remotos(rclone="rclone", env=None):
    """Lê `rclone config dump` e afirma: arq = crypt sobre b2arq:, nomes sem cifra; b2arq = b2 (02 §10.9)."""
    try:
        r = subprocess.run([rclone, "config", "dump"], capture_output=True, text=True, timeout=60, env=env)
        d = json.loads(r.stdout) if r.returncode == 0 else None
    except (OSError, ValueError, subprocess.TimeoutExpired):
        d = None
    if not isinstance(d, dict):
        raise ConfigB2("chave_ausente")
    arq, b2 = d.get("arq") or {}, d.get("b2arq") or {}
    if arq.get("type") != "crypt" or not arq.get("password"):
        raise ConfigB2("chave_ausente")
    remoto = str(arq.get("remote") or "")
    if b2.get("type") != "b2" or not remoto.startswith("b2arq:") or arq.get("filename_encryption") != "off":
        raise ConfigB2("remoto_nao_b2")
    caminho = remoto[len("b2arq:"):].strip("/")
    bucket, _, prefixo = caminho.partition("/")
    if not bucket or not b2.get("account") or not b2.get("key"):
        raise ConfigB2("remoto_nao_b2")
    return {"conta": b2["account"], "chave": b2["key"], "bucket": bucket, "prefixo": prefixo,
            "senha": arq["password"], "senha2": arq.get("password2") or ""}


def nome_b2(conf, filho, relativo, sufixo):
    return "/".join(p for p in (conf["prefixo"], filho, relativo) if p) + sufixo


class B2:
    def __init__(self, conta, chave, bucket, base="https://api.backblazeb2.com", timeout=60,
                 banda_bps=None, dormir=time.sleep, relogio=time.monotonic):
        self._conta, self._chave, self.bucket, self.base = conta, chave, bucket, base.rstrip("/")
        self.timeout, self.banda_bps, self.dormir, self.relogio = timeout, banda_bps, dormir, relogio
        self.token = self.api = self.download = self.bucket_id = self.conta_id = None

    def _abrir(self, req):
        try:
            return urllib.request.urlopen(req, timeout=self.timeout)
        except urllib.error.HTTPError as e:
            raise ErroB2("http %d" % e.code, e.code)
        except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as e:
            raise ErroB2(type(e).__name__)

    def autorizar(self):
        """b2api/v4. O accountId vem da resposta (não é o keyId: Yannis, importante 4)."""
        cred = base64.b64encode(("%s:%s" % (self._conta, self._chave)).encode()).decode()
        req = urllib.request.Request(self.base + "/b2api/v4/b2_authorize_account", headers={"Authorization": "Basic " + cred})
        try:
            with self._abrir(req) as r:
                d = json.loads(r.read())
            arm = d["apiInfo"]["storageApi"]
            self.token, self.conta_id, self.api, self.download = d["authorizationToken"], d["accountId"], arm["apiUrl"], arm["downloadUrl"]
            baldes = (arm.get("allowed") or {}).get("buckets") or []
        except (KeyError, TypeError, ValueError, http.client.HTTPException):
            raise ErroB2("resposta de autorização fora da forma")
        if baldes:                              # chave restrita: o bucket do arq: tem de estar na lista
            meu = [b for b in baldes if isinstance(b, dict) and b.get("name") == self.bucket and b.get("id")]
            if not meu:
                raise ErroB2("a chave é de outro bucket")
            self.bucket_id = meu[0]["id"]
        else:
            self.bucket_id = self._bucket_id()
        return self

    def _post(self, rota, corpo):
        req = urllib.request.Request(self.api + "/b2api/v4/" + rota, data=json.dumps(corpo).encode(), method="POST",
                                     headers={"Authorization": self.token, "Content-Type": "application/json"})
        with self._abrir(req) as r:
            try:
                return json.loads(r.read())
            except (ValueError, OSError, http.client.HTTPException):
                raise ErroB2("resposta fora da forma")

    def _bucket_id(self):
        d = self._post("b2_list_buckets", {"accountId": self.conta_id, "bucketName": self.bucket})
        b = [x for x in d.get("buckets", []) if x.get("bucketName") == self.bucket]
        if len(b) != 1:
            raise ErroB2("bucket não encontrado")
        return b[0]["bucketId"]

    def versoes(self, nome):
        """Todas as versões do nome exato, da mais nova para a mais antiga. [] = não existe (a única ausência)."""
        d = self._post("b2_list_file_versions", {"bucketId": self.bucket_id, "prefix": nome, "startFileName": nome, "maxFileCount": 100})
        if not isinstance(d.get("files"), list):
            raise ErroB2("listagem fora da forma")
        return [f for f in d["files"] if f.get("fileName") == nome]

    def atual(self, nome):
        """A versão viva do nome, ou None (ausente). C7.2: a versão `start` (envio grande em curso) não conta como
        presente nem como ausente: é pulada; só `start` (sem upload nem hide) é ErroB2 (sem_acesso). `hide` mais nova = ausente."""
        v = self.versoes(nome)
        vs = [f for f in v if f.get("action") in ("upload", "hide")]
        if not vs:
            if v:
                raise ErroB2("só versão start (envio em curso)")
            return None
        if vs[0]["action"] == "hide":
            return None
        f = vs[0]
        if not RE_FILE_ID.match(str(f.get("fileId", ""))) or not isinstance(f.get("uploadTimestamp"), int):
            raise ErroB2("versão sem fileId ou uploadTimestamp no formato")
        return f

    def baixar(self, file_id, destino, restante):
        """Baixa os bytes do fileId (os mesmos que serão informados). Para antes de passar de `restante` bytes.
        Devolve (bytes, nome do x-bz-file-name). Confere o X-Bz-Content-Sha1 quando ele vem (envio grande traz 'none')."""
        if not RE_FILE_ID.match(file_id):
            raise ErroB2("fileId fora do formato")
        url = self.download + "/b2api/v4/b2_download_file_by_id?" + urllib.parse.urlencode({"fileId": file_id})
        req = urllib.request.Request(url, headers={"Authorization": self.token})
        n, t0, h1 = 0, self.relogio(), hashlib.sha1()
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with self._abrir(req) as r, open(destino, "wb") as f:
            nome = urllib.parse.unquote(r.headers.get("x-bz-file-name", ""))
            sha1 = (r.headers.get("x-bz-content-sha1") or "").lower()
            tamanho = int(r.headers.get("Content-Length") or -1)
            if tamanho > restante:
                raise TetoDeBytes(tamanho)
            while True:
                try:
                    bloco = r.read(64 * 1024)
                except (OSError, http.client.HTTPException) as e:
                    raise ErroB2("leitura: %s" % type(e).__name__)
                if not bloco:
                    break
                n += len(bloco)
                if n > restante:
                    raise TetoDeBytes(n)
                f.write(bloco)
                h1.update(bloco)
                if self.banda_bps:              # P32: o limite de banda mora no programa
                    adiantado = n / self.banda_bps - (self.relogio() - t0)
                    if adiantado > 0:
                        self.dormir(adiantado)
        if tamanho >= 0 and n != tamanho:
            raise ErroB2("leitura curta")
        if re.fullmatch(r"[0-9a-f]{40}", sha1) and h1.hexdigest() != sha1:
            raise ErroB2("sha1 do B2 não bate com os bytes baixados")
        return n, nome


def decifrar(rclone, conf, pasta_cifrada, relativos, pasta_saida, sufixo, env_base=None, timeout=1800):
    """Decifra pelo rclone, com um remoto crypt sobre a pasta local, montado só em variáveis de ambiente
    (a senha obscurecida nunca vai para a linha de comando). Um processo para o lote (P37); se ele falhar,
    um por arquivo, para saber qual não decifra. Devolve {relativo: True|False}."""
    env = dict(os.environ if env_base is None else env_base)
    env.update({"RCLONE_CONFIG_ARQLOCAL_TYPE": "crypt", "RCLONE_CONFIG_ARQLOCAL_REMOTE": pasta_cifrada,
                "RCLONE_CONFIG_ARQLOCAL_FILENAME_ENCRYPTION": "off", "RCLONE_CONFIG_ARQLOCAL_DIRECTORY_NAME_ENCRYPTION": "false",
                "RCLONE_CONFIG_ARQLOCAL_PASSWORD": conf["senha"], "RCLONE_CONFIG_ARQLOCAL_PASSWORD2": conf["senha2"]})
    if sufixo != ".bin":
        env["RCLONE_CONFIG_ARQLOCAL_SUFFIX"] = sufixo
    fd, lista = tempfile.mkstemp(prefix="arq-lista-")
    with os.fdopen(fd, "w") as f:
        f.write("".join(r + "\n" for r in relativos))
    try:
        r = subprocess.run([rclone, "copy", "arqlocal:", pasta_saida, "--files-from", lista],
                           capture_output=True, text=True, timeout=max(60, timeout), env=env)
        lote_ok = r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        lote_ok = False
    finally:
        os.unlink(lista)
    if lote_ok:
        return {rel: os.path.isfile(os.path.join(pasta_saida, rel)) for rel in relativos}
    saida = {}
    for rel in relativos:                       # o lote falhou: um por arquivo, sem confiar no que o lote deixou
        destino = os.path.join(pasta_saida, rel)
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        try:
            with open(destino, "wb") as f:
                r = subprocess.run([rclone, "cat", "arqlocal:" + rel], stdout=f, stderr=subprocess.PIPE, timeout=max(60, min(600, timeout)), env=env)
            saida[rel] = r.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            saida[rel] = False
        if not saida[rel] and os.path.exists(destino):
            os.unlink(destino)
    return saida
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_site_b2.py | tail -1`
Expected: `site e b2: 0 falha(s)`.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/cliente_site.py arquivo/b2.py arquivo/falsos.py arquivo/teste_site_b2.py
git -C $K commit -m "feat: arquivo M3b, clientes do site e do B2 (b2api/v4, fileId pela API nativa, ausência só de listagem 200) e os falsos de teste" -- arquivo/cliente_site.py arquivo/b2.py arquivo/falsos.py arquivo/teste_site_b2.py
```

---

### Task 3: o copiador

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/copiador/copiar.py`
- Modify: `~/Workspace/forja/ferramentas/arquivo/falsos.py` (acrescenta `SiteArquivoFalso` e `arquivo_b64` no fim)
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_copiador.py`

**Interfaces:**
- Consumes: contrato r2.1: C1 (`GET plan`, `reconferir` em páginas por `cursor` **em qualquer modo**), C3 (`unit/export`, bytes e cabeçalhos `X-Arquivo-*`, `X-Arquivo-Soma` vazio em toda parte, `409`/`413`/`422`), C4 (`month/summary`), C5 (`month/manifest`), C6 (`unit/received`, até 100 itens), C7.1 (`attest` fonte `nas`, até 500 itens, `canarios` com resposta por canário, resultado `ilegivel`), C8 (`heartbeat` com `total_bytes` e `parado_no_teto`); interfaces da M3a (`copiador.jsonl`, `plano.json`, `chaves/copiador.chave`).
- Produces: `copiar.main(argv, env, eh_montagem) -> int`; o registro `/opt/arquivo/log/copiador.jsonl` (uma linha por execução: `quando`, `modo` em `cron`/`prova`/`completo`, `desfecho` em `ok`, `nas_cheio`, `controle_falhou`, `nas_fora`, `nas_ilegivel`, `plano_invalido`, `unidade_falhou`, `informe_recusado`, `incompleto`, `arquivo_desligado`, `site_fora`, `chave`, `timeout`, `bug` (D-F19); mais `plano_id`, `modo_plano`, `filhos` (com `uso` e `alerta_80`), `contagens` (inclusive `recebendo_arquivos`), `pulos`, `parcial`, `duracao_s`); `/opt/arquivo/estado/plano.json`; `/opt/arquivo/estado/aguardando_dono.json`; os canários `_canario/<dia>` nos dois filhos.

**A ordem de uma execução (D-F18):** `GET plan` → batimento → `plano.json` → canário do dia (e poda dos de mais de 30 dias) → `attest` só com os dois canários → `a_apagar` → `exportar` (com `unit/received` a cada 100) → `unit/received` do resto (sempre, mesmo com o NAS cheio) → resumos → manifestos → `aguardando_dono` → reconferência (página a página, em qualquer modo) → batimento final → linha do registro. Em `--prova`, só o `GET plan`.

**O que acontece quando o dado não existe:** plano com listas vazias é uma execução `ok` que só grava o canário e informa a reconferência vazia (o site decide o atraso: `02` §10.6, "Quem mede o atraso é o site"); filho desmontado ou sem sentinela: nada gravado nem pedido naquele filho, a reconferência dele vai como `nas_fora` (nunca `ausente`), desfecho `nas_fora`; arquivo final ausente com o filho bom: `ausente`, **também quando o arquivo só existe em `_recebendo/`** (X2: na reconferência só o caminho final conta; em `aguardando_dono` o copiador procura nos dois lugares); final já existente na hora de exportar: nada vai a `_recebendo`, o final é relido e informado; plano sem um dos campos do C1, `vermelhos` nulo ou `prefixos_ausentes` não vazio: `plano_invalido`, sem `plano.json` (o pulso vê o velho e fica vermelho em 13 h); resumo `vazio: false` sem arquivos, ou manifesto sem exatamente o `.json` e o `.sha256`: `plano_invalido`. **Quando dá erro:** bytes que não batem com o cabeçalho, pede de novo uma vez (duas vezes: `unidade_falhou`); parte com `X-Arquivo-Soma` preenchido: `plano_invalido`; disco cheio, `nas_cheio`, nada no final e o que já estava no final informado; erro de E/S ao reler um arquivo: `ilegivel` no informe, os seguintes continuam, desfecho `nas_ilegivel`; informe recusado (`400`, resultado `desconhecido`, `recusado`): `informe_recusado`; recusa de exportação que o plano não devia ter pedido (`mes_aberto`, `nao_devida`, `unidade_retirada`, `mes_fora_do_banco`, `grande_demais`, `faixa_invalida`, `tabela_ausente`): `incompleto`, vermelho (X5); canário recusado pelo site: `controle_falhou`; `503 arquivo_desligado`, `401/403` ou site fora, **também no meio da execução**: desfecho próprio com `parcial` e `contagens`; `SIGTERM`: `timeout`; defeito do programa, `bug` (traceback no `.err`).

- [ ] **Step 1: Acrescentar o site falso e escrever o teste que falha**

No fim de `arquivo/falsos.py`:

```python
RE_SHA = re.compile(r"^[0-9a-f]{64}$")
RE_SOMA = re.compile(r"^-?\d+$")
RE_FILE_ID = re.compile(r"^4_z[0-9a-f]{24}_f[0-9a-f]{3}_[0-9a-z_]+$")


def _int_nn(v):
    return type(v) is int and v >= 0


def _valores_ok(i, exige):
    """sha256, bytes, linhas e soma: com `exige`, presentes e na forma; sem, ausentes."""
    if not exige:
        return not any(k in i for k in ("sha256", "bytes", "linhas", "soma"))
    return (isinstance(i.get("sha256"), str) and RE_SHA.match(i["sha256"]) and _int_nn(i.get("bytes"))
            and (i.get("linhas") is None or _int_nn(i.get("linhas"))) and "linhas" in i and "soma" in i
            and (i.get("soma") is None or (isinstance(i["soma"], str) and RE_SOMA.match(i["soma"]))))


def zod_heartbeat(d):
    """O esquema Zod do C8 (r2), espelhado: corpo fora dele = 400 VALIDATION_ERROR, como no site."""
    par = lambda v, f: isinstance(v, dict) and set(v) == {"numerico", "texto"} and all(f(x) for x in v.values())
    return (isinstance(d, dict) and isinstance(d.get("versao"), str) and isinstance(d.get("hora_maquina"), str)
            and type(d.get("nas_ok")) is bool and par(d.get("montagens_ok"), lambda x: type(x) is bool)
            and par(d.get("sentinela_ok"), lambda x: type(x) is bool)
            and par(d.get("livre_bytes"), lambda x: x is None or _int_nn(x)) and par(d.get("total_bytes"), lambda x: x is None or _int_nn(x))
            and d.get("parado_no_teto", "falta") in ("dia", "mes", None)
            and (d.get("ultimo_erro", "falta") is None or (isinstance(d.get("ultimo_erro"), str) and len(d["ultimo_erro"]) <= 200)))


def zod_received(d):
    itens = d.get("itens") if isinstance(d, dict) else None
    return (isinstance(itens, list) and 1 <= len(itens) <= 100
            and all(isinstance(i, dict) and set(i) == {"arquivo_id", "sha256", "bytes", "linhas", "soma"} and _valores_ok(i, True) for i in itens))


def zod_attest(d):
    if not isinstance(d, dict) or d.get("fonte") not in ("nas", "b2") or not isinstance(d.get("itens"), list):
        return False
    itens = d["itens"]
    if d["fonte"] == "nas":
        fil = d.get("filhos")
        if not (isinstance(fil, dict) and set(fil) == {"numerico", "texto"} and isinstance(d.get("canarios"), list) and len(itens) <= 500):
            return False
        if not all(isinstance(x, dict) and x.get("filho") in ("numerico", "texto") and isinstance(x.get("sha256"), str)
                   and RE_SHA.match(x["sha256"]) for x in d["canarios"]):
            return False
        for i in itens:
            r = i.get("resultado")
            if r == "presente" and not _valores_ok(i, True):
                return False
            if r in ("ausente", "nas_fora", "ilegivel") and not _valores_ok(i, False):
                return False
            if r not in ("presente", "ausente", "nas_fora", "ilegivel"):
                return False
        return True
    if not (1 <= len(itens) <= 200 and isinstance(d.get("execucao_id"), str)):
        return False
    for i in itens:
        r, neg = i.get("resultado"), i.get("arquivo_id") == "controle_negativo"
        if i.get("tentativa") not in (1, 2) or r not in ("presente", "ausente", "sem_acesso", "chave_ausente", "nao_decifra"):
            return False
        com_id = isinstance(i.get("file_id"), str) and RE_FILE_ID.match(i["file_id"]) and _int_nn(i.get("upload_timestamp"))
        if r == "presente" and not (com_id and _valores_ok(i, not neg)):
            return False
        if r == "nao_decifra" and not (com_id and _valores_ok(i, False)):
            return False
        if r in ("ausente", "sem_acesso", "chave_ausente") and not (_valores_ok(i, False) and "file_id" not in i):
            return False
    return True


class SiteArquivoFalso:
    """O lado do site, só no que o contrato C1 a C8 (r2) diz, com o Zod das rotas espelhado (400 VALIDATION_ERROR).
    O teste monta os planos e as unidades; o falso responde e guarda tudo. Em toda PARTE o X-Arquivo-Soma vem vazio
    (C3 r2: o falso que mandava a soma da parte escondia o defeito C1/crítico 2 das revisões).
    Silêncio da casa (C1 r2, (a)): com `ultimo_bom` (epoch do último batimento bom do copiador), o GET plan abre a
    varredura se ele tem mais de 24 h; (b) o batimento bom cujo anterior tem mais de 24 h também abre."""
    def __init__(self):
        self.planos = {}            # (fonte, cursor) -> data do plano, ou (status, {"error": ...})
        self.unidades = {}          # (classe, tabela, canal, mes) -> {"id", "versao", "partes": [csv], "coluna", "vazia", "recusa"}
        self.resumos, self.manifestos = {}, {}      # (classe, canal, mes) / (classe, mes) -> resposta (data) ou (status, code)
        self.recebido_resultado = {}                # arquivo_id -> resultado diferente de 'recebida'
        self.corromper = Counter()                  # (classe, tabela, canal, mes, parte) -> vezes a corromper
        self.recusar_parte = {}                     # (classe, tabela, canal, mes) -> parte que recebe 409 parte_mudou
        self.soma_na_parte = False                  # True: o falso viola o C3 (para provar que a forja recusa)
        self.attest_resposta = None                 # função(corpo) -> data, para o B2
        self.canario_recusar = set()                # filhos cujo canário o attest nas responde 'recusado'
        self.falhar = {}                            # rota -> (status, code): para provar o meio da execução
        self.ultimo_bom, self.varredura = None, False
        self.teto_cor = None                        # C8 r2.2: a cor do teto que o batimento devolve (o site conta os dias)
        self.received, self.attests, self.batimentos, self.exports, self.recusados_zod = [], [], [], [], []
        self.srv = Servidor(self._h)
        self.url = self.srv.url

    def _zod(self, rota, d):
        self.recusados_zod.append((rota, d))
        return json_resp(400, {"error": {"code": "VALIDATION_ERROR", "message": "corpo fora do esquema"}})

    def _h(self, metodo, caminho, consulta, cab, corpo):
        rota = caminho.split("/api/pipeline/archive/", 1)[-1]
        d = json.loads(corpo) if corpo else None
        if rota in self.falhar:
            s, code = self.falhar[rota]
            return json_resp(s, {"error": {"code": code}})
        if rota == "plan":
            r = self.planos.get((consulta.get("fonte", "nas"), consulta.get("cursor")))
            if r is None:
                return json_resp(500, {"error": {"code": "erro_do_banco"}})
            if isinstance(r, tuple):
                return json_resp(r[0], r[1])
            if consulta.get("fonte", "nas") == "nas" and consulta.get("cursor") is None:
                if self.ultimo_bom is not None and time.time() - self.ultimo_bom > 24 * 3600:
                    self.varredura = True
                if self.varredura:
                    r = dict(r, modo="completo")
            return json_resp(200, {"data": r})
        if rota == "heartbeat":
            if not zod_heartbeat(d):
                return self._zod(rota, d)
            self.batimentos.append(d)
            if d["nas_ok"] and self.ultimo_bom is not None:
                if time.time() - self.ultimo_bom > 24 * 3600:
                    self.varredura = True
                self.ultimo_bom = time.time()
            return json_resp(200, {"data": {"gravado": True, "teto": self.teto_cor}})
        if rota == "unit/export":
            self.exports.append(d)
            k = (d["classe"], d["tabela"], d["canal"], d["mes"])
            u = self.unidades.get(k)
            if u is None or u.get("recusa"):
                return json_resp(409, {"error": {"code": (u or {}).get("recusa", "nao_devida")}})
            if u.get("vazia"):
                return json_resp(200, {"data": {"arquivo_id": "u:" + u["id"], "versao": u["versao"], "vazia": True, "linhas": 0}})
            p = d.get("parte", 1)
            if self.recusar_parte.get(k) == p:
                return json_resp(409, {"error": {"code": "parte_mudou"}})
            partes = u["partes"]
            texto = partes[p - 1]
            dados = gz(texto)
            linhas = texto.count("\n") - 1
            soma = None
            if u.get("coluna"):
                cab_csv = texto.split("\n", 1)[0].split(",")
                i = cab_csv.index(u["coluna"])
                soma = str(sum(int(l.split(",")[i]) for l in texto.split("\n")[1:] if l and l.split(",")[i] != ""))
            dois = len(partes) > 1
            rel = "%s/canais/%s/%s/%s.v%d%s.csv.gz" % (d["classe"], d["canal"], d["tabela"], d["mes"], u["versao"], (".p%02d" % p) if dois else "")
            h = {"Content-Type": "application/gzip", "X-Arquivo-Id": ("p:%s:%02d" % (u["id"], p)) if dois else "u:" + u["id"],
                 "X-Arquivo-Versao": str(u["versao"]), "X-Arquivo-Caminho": u.get("caminho_falso", rel), "X-Arquivo-Linhas": str(linhas),
                 "X-Arquivo-Soma": u.get("soma_falsa", (soma or "") if (not dois or self.soma_na_parte) else ""),
                 "X-Arquivo-Sha256": sha(dados), "X-Arquivo-Csv-Sha256": sha(texto.encode()),
                 "X-Arquivo-Bytes": str(len(dados)), "X-Arquivo-Partes": str(len(partes)), "X-Arquivo-Parte": str(p),
                 "X-Arquivo-Coluna-Controle": u.get("coluna") or ""}
            if self.corromper[k + (p,)] > 0:
                self.corromper[k + (p,)] -= 1
                dados = dados[:-1] + bytes([dados[-1] ^ 1])
            return 200, h, dados
        if rota == "unit/received":
            if not zod_received(d):
                return self._zod(rota, d)
            self.received.append(d["itens"])
            return json_resp(200, {"data": {"itens": [{"arquivo_id": i["arquivo_id"], "resultado": self.recebido_resultado.get(i["arquivo_id"], "recebida")}
                                                      for i in d["itens"]], "selados": []}})
        if rota in ("month/summary", "month/manifest"):
            k = (d["classe"], d["canal"], d["mes"]) if rota == "month/summary" else (d["classe"], d["mes"])
            r = (self.resumos if rota == "month/summary" else self.manifestos).get(k)
            if isinstance(r, tuple):
                return json_resp(r[0], {"error": {"code": r[1]}})
            return json_resp(200, {"data": r})
        if rota == "attest":
            if not zod_attest(d):
                return self._zod(rota, d)
            self.attests.append(d)
            if self.attest_resposta:
                return json_resp(200, {"data": self.attest_resposta(d)})
            can = [{"filho": x["filho"], "dia": x["dia"], "resposta": "recusado" if x["filho"] in self.canario_recusar else "aceito"}
                   | ({"motivo": "sha256_diferente_no_dia"} if x["filho"] in self.canario_recusar else {}) for x in d.get("canarios", [])]
            return json_resp(200, {"data": {"itens": [{"arquivo_id": i["arquivo_id"], "resposta": "aceito"} for i in d["itens"]], "canarios": can}})
        return json_resp(404, {"error": {"code": "NOT_FOUND"}})


def arquivo_b64(arquivo_id, papel, caminho, conteudo):
    dados = gz(conteudo) if caminho.endswith(".gz") else conteudo.encode()
    return {"arquivo_id": arquivo_id, "tipo": "resumo" if papel else "manifesto", "papel": papel, "caminho": caminho,
            "sha256": sha(dados), "bytes": len(dados), "linhas": (conteudo.count("\n") - 1) if caminho.endswith(".gz") else None,
            "conteudo_base64": base64.b64encode(dados).decode()}
```

`arquivo/teste_copiador.py`:

```python
"""M3b: prova o copiador contra o site falso e uma árvore de NAS falsa. Uso: python3 teste_copiador.py
Itens 27, 30, 74, 76, 79 e a parte da forja do 172. Nunca toca na forja nem na rede."""
import errno, json, os, sys, tempfile, time
from datetime import date, timedelta
import importlib.util

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import comum as c  # noqa: E402
import falsos as F  # noqa: E402

spec = importlib.util.spec_from_file_location("copiar", os.path.join(AQUI, "copiador", "copiar.py"))
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

falhas = []
CANAL = "0b6f3c2e-6a51-4c1e-9d0e-6f2b1a7c9e10"
U1, U2, U3 = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"
HOJE = c.hoje_sp()
CSV1 = "id,views\n1,10\n2,\n3,5\n"
LIVRE = [0.5]           # fração livre que o statvfs falso devolve (o disco do Mac não decide o teste)


class _Statvfs:
    def __init__(self, livre):
        self.f_blocks, self.f_frsize, self.f_bavail = 1000, 4096, int(1000 * livre)


os.statvfs = lambda p: _Statvfs(LIVRE[0])


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def rel_u(classe, tabela, mes="2026-10", v=1, p=None):
    return c.caminho_unidade(classe, CANAL, tabela, mes, v, p)[1]


def plano(**kw):
    d = {"plano_id": "aaaaaaaa-0000-4000-8000-000000000001", "gerado_em": "2026-11-28T09:00:00Z", "modo": "normal",
         "cursor_seguinte": None, "primeira_selagem": None, "vermelhos": [], "canario": {"dia": HOJE},
         "exportar": [], "resumos": [], "manifestos": [], "aguardando_dono": [], "a_apagar": [], "reconferir": [], "prefixos_ausentes": []}
    d.update(kw)
    return d


def item(tipo, aid, classe, tabela, mes, v, caminho, coluna=None, canal=CANAL):
    return {"arquivo_id": aid, "tipo": tipo, "filho": c.CLASSES[classe], "caminho": caminho, "classe": classe,
            "tabela": tabela, "canal": canal, "mes": mes, "versao": v, "coluna_controle": coluna}


class Caso:
    def __init__(self, desmontados=(), sem_sentinela=()):
        self.tmp = tempfile.mkdtemp(prefix="copiador-")
        self.base = os.path.join(self.tmp, "opt")
        self.esc = os.path.join(self.tmp, "mnt")
        for f in c.FILHOS:
            os.makedirs(os.path.join(self.esc, f))
            if f not in sem_sentinela and f not in desmontados:
                open(os.path.join(self.esc, f, c.SENTINELA), "w").close()
        os.makedirs(os.path.join(self.base, "chaves"))
        ch = os.path.join(self.base, "chaves", "copiador.chave")
        open(ch, "w").write("forja_" + "k" * 43 + "\n")
        os.chmod(ch, 0o600)
        self.desmontados = {os.path.join(self.esc, f) for f in desmontados}
        self.site = F.SiteArquivoFalso()
        self.env = {"ARQUIVO_BASE": self.base, "ARQ_SITE": self.site.url, "ARQ_MONTAGEM_ESCRITA": self.esc, "ARQ_ENV": "/nao/existe", "ARQ_RITMO_S": "0"}

    def rodar(self, modo="cron", **env):
        e = dict(self.env, **env)
        rc = cp.main(["--" + modo], env=e, eh_montagem=lambda p: p not in self.desmontados)
        linhas = open(os.path.join(self.base, "log", "copiador.jsonl")).read().splitlines()
        return rc, json.loads(linhas[-1])

    def em(self, filho, rel):
        return os.path.join(self.esc, filho, rel)

    def parar(self):
        self.site.srv.parar()


def recebidos(k):
    return [i for lote in k.site.received for i in lote]


# ---------- 1. caminho feliz: exporta, relê, move, informa ----------
k = Caso()
k.site.unidades[("serie", "competitor_video_daily", CANAL, "2026-10")] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
final = k.em("numerico", rel_u("serie", "competitor_video_daily"))
exige(rc == 0 and l["desfecho"] == "ok" and l["modo"] == "cron", "feliz: desfecho ok, modo cron")
exige(os.path.isfile(final) and c.ler_csv_gz(final, "views") == (3, "15"), "feliz: arquivo no caminho final, legível pelo leitor")
exige(os.listdir(k.em("numerico", "_recebendo/serie/canais/%s/competitor_video_daily" % CANAL)) == [], "feliz: _recebendo vazio depois do rename")
r = recebidos(k)
exige(len(r) == 1 and r[0]["arquivo_id"] == "u:" + U1 and r[0]["linhas"] == 3 and r[0]["soma"] == "15" and r[0]["sha256"] == c.sha256_arquivo(final)[0],
      "feliz: unit/received com sha256, contagem e soma RELIDOS do NAS (item 76)")
pl = json.load(open(os.path.join(k.base, "estado", "plano.json")))
exige(pl["vermelhos"] == [] and "obtido_em" in pl, "plano.json gravado (interface da M3a)")
b = k.site.batimentos[0]
exige(b["nas_ok"] is True and b["montagens_ok"] == {"numerico": True, "texto": True} and "hora_maquina" in b and "livre_bytes" in b,
      "batimento na rota do arquivo, com montagens, sentinela, livre e hora da forja (item 30)")
exige(b["total_bytes"] == {"numerico": 4096000, "texto": 4096000} and b["parado_no_teto"] is None and k.site.recusados_zod == [],
      "batimento com total_bytes (o site acende nas_80) e parado_no_teto nulo; todo corpo passa no Zod espelhado (C8 r2)")
rotas = [p_[1].rsplit("/archive/", 1)[-1] for p_ in k.site.srv.pedidos]
exige(rotas[:3] == ["plan", "heartbeat", "attest"], "K3: GET plan ANTES do batimento; o attest com os canários logo depois (Yannis, importante 1)")
exige(k.site.attests[0]["itens"] == [] and len(k.site.attests[0]["canarios"]) == 2, "o primeiro attest leva só os dois canários, antes de qualquer exportação")
can = k.site.attests[-1]["canarios"]
exige(sorted(x["filho"] for x in can) == ["numerico", "texto"] and all(os.path.isfile(k.em(x["filho"], "_canario/" + HOJE)) for x in can),
      "canário do dia gravado nos DOIS filhos e informado no attest (item 134)")
exige(all(x["sha256"] == c.sha256_arquivo(k.em(x["filho"], "_canario/" + HOJE))[0] for x in can), "sha256 do canário é o do arquivo gravado")
rc, l = k.rodar()
exige(len([x for x in k.site.attests[-1]["canarios"]]) == 2 and l["contagens"].get("canario_gravado", 0) == 0, "segunda execução: o canário do dia não é regravado")
k.parar()

# ---------- 2. NAS fora: filho desmontado e filho sem sentinela (item 27) ----------
for rotulo, kw in (("desmontado", {"desmontados": ("texto",)}), ("sem sentinela", {"sem_sentinela": ("texto",)})):
    k = Caso(**kw)
    k.site.unidades[("texto", "competitor_raw", CANAL, "2026-10")] = {"id": U2, "versao": 1, "partes": ["id\n1\n"]}
    k.site.unidades[("serie", "competitor_video_daily", CANAL, "2026-10")] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
    rt = rel_u("texto", "competitor_raw")
    k.site.planos[("nas", None)] = plano(
        exportar=[{"classe": "texto", "tabela": "competitor_raw", "canal": CANAL, "mes": "2026-10", "motivo": "nova"},
                  {"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}],
        reconferir=[item("unidade", "u:" + U3, "texto", "competitor_raw", "2026-09", 1, rel_u("texto", "competitor_raw", "2026-09"))])
    rc, l = k.rodar()
    exige(l["desfecho"] == "nas_fora", "%s: desfecho nas_fora" % rotulo)
    exige(not os.path.exists(k.em("texto", rt)) and not os.path.exists(k.em("texto", "_canario")), "%s: nada gravado no filho (nem no disco local)" % rotulo)
    exige(all(e["classe"] != "texto" for e in k.site.exports), "%s: nem pede a exportação do filho fora" % rotulo)
    exige(os.path.isfile(k.em("numerico", rel_u("serie", "competitor_video_daily"))), "%s: o outro filho segue" % rotulo)
    it = [i for a in k.site.attests for i in a["itens"]]
    exige([i["resultado"] for i in it] == ["nas_fora"], "%s: reconferência do filho fora é nas_fora, NUNCA ausente" % rotulo)
    exige(k.site.batimentos[0]["nas_ok"] is False, "%s: batimento com nas_ok falso" % rotulo)
    k.parar()

# ---------- 3. transporte, releitura e destino existente (item 27) ----------
k = Caso()
K1 = ("serie", "competitor_video_daily", CANAL, "2026-10")
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.corromper[K1 + (1,)] = 1
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and len(k.site.exports) == 2 and os.path.isfile(k.em("numerico", rel_u(*K1[:2]))), "bytes que não batem com o cabeçalho: pede de novo, uma vez")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.corromper[K1 + (1,)] = 2
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(not os.path.exists(k.em("numerico", rel_u(*K1[:2]))) and recebidos(k) == [] and l["contagens"].get("unidade_falhou") == 1,
      "duas vezes errado: nada no final, nada informado")
exige(l["desfecho"] == "unidade_falhou" and rc == 1, "duas vezes errado: desfecho unidade_falhou (vermelho), nunca ok (I1 do Phil, importante 8 do Yannis)")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
destino = k.em("numerico", rel_u(*K1[:2]))
os.makedirs(os.path.dirname(destino))
open(destino, "wb").write(F.gz("id,views\n9,9\n"))
antes = c.sha256_arquivo(destino)[0]
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(c.sha256_arquivo(destino)[0] == antes, "item 27: arquivo final existente com outro hash NÃO é sobrescrito")
exige(recebidos(k)[0]["sha256"] == antes and recebidos(k)[0]["linhas"] == 1, "informa o que está no final (o site conclui divergente)")
exige(not os.path.exists(k.em("numerico", c.nome_recebendo(rel_u(*K1[:2])))), "a sobra da tentativa sai de _recebendo")
k.parar()

# ---------- 4. partes ----------
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 2, "partes": ["id,views\n1,1\n", "id,views\n2,2\n"], "coluna": "views"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige([e.get("parte") for e in k.site.exports] == [None, 2], "unidade em partes: pede a parte 2 depois da 1")
exige(all(os.path.isfile(k.em("numerico", rel_u(*K1[:2], v=2, p=p))) for p in (1, 2)), "as duas partes no final")
exige([i["arquivo_id"] for i in recebidos(k)] == ["p:%s:01" % U1, "p:%s:02" % U1], "informa parte por parte")
exige([(i["linhas"], i["soma"]) for i in recebidos(k)] == [(1, "1"), (1, "2")] and l["desfecho"] == "ok" and "unidade_falhou" not in l["contagens"],
      "C1/crítico 2: cabeçalho de soma VAZIO em cada parte (C3); a soma relida DA PARTE vai no unit/received; desfecho ok")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 2, "partes": ["id,views\n1,1\n", "id,views\n2,2\n"], "coluna": "views"}
k.site.soma_na_parte = True
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(l["desfecho"] == "plano_invalido" and recebidos(k) == [] and not os.path.exists(k.em("numerico", rel_u(*K1[:2], v=2, p=1))),
      "parte com X-Arquivo-Soma preenchido (o site fugiu do C3): plano_invalido, nada no final")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views", "soma_falsa": "16"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(l["contagens"].get("diferente_releitura") == 2 and l["desfecho"] == "unidade_falhou" and recebidos(k) == [],
      "unidade inteira com soma diferente da relida: Diferente duas vezes, desfecho unidade_falhou (C9 r2), nunca ok")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 2, "partes": ["id,views\n1,1\n", "id,views\n2,2\n"], "coluna": "views"}
k.site.recusar_parte[K1] = 2
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(not os.path.exists(k.em("numerico", rel_u(*K1[:2], v=2, p=1))) and not os.path.exists(k.em("numerico", c.nome_recebendo(rel_u(*K1[:2], v=2, p=1)))),
      "parte_mudou: a parte 1 sai de _recebendo e nada vai ao final")
exige(recebidos(k) == [] and l["pulos"].get("parte_mudou") == 1 and l["desfecho"] == "ok", "parte_mudou: nada informado, pulada (o plano a devolve)")
k.parar()

# ---------- 5. recusas da exportação ----------
for code, desf in (("canal_removido", "ok"), ("mudou_durante_a_leitura", "ok"), ("mes_aberto", "incompleto"), ("nao_devida", "incompleto"),
                   ("unidade_retirada", "incompleto"), ("mes_fora_do_banco", "incompleto"), ("faixa_invalida", "incompleto"),
                   ("tabela_ausente", "incompleto"), ("classe_tabela_invalida", "plano_invalido")):
    k = Caso()
    k.site.unidades[K1] = {"id": U1, "versao": 1, "recusa": code}
    k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
    rc, l = k.rodar()
    exige(l["desfecho"] == desf and l["pulos"].get(code) == 1, "%s: pula a unidade, desfecho %s" % (code, desf))
    k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "vazia": True}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(l["contagens"].get("vazia") == 1 and not os.path.exists(k.em("numerico", "serie")), "vazia conferida: nenhum arquivo, nada informado")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views", "caminho_falso": "serie/../../etc/x"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(l["desfecho"] == "plano_invalido" and recebidos(k) == [], "X-Arquivo-Caminho diferente do montado: nada gravado, plano_invalido")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_videos", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(l["desfecho"] == "plano_invalido" and k.site.exports == [], "tabela fora da lista fechada: nem pede (D-F11)")
k.parar()

# ---------- 6. resumo e manifesto ----------
k = Caso()
RB = "s:" + U2
rc_, rv_ = (c.caminho_resumo("serie", CANAL, "2026-10", 1, p)[1] for p in ("canal", "video"))
k.site.resumos[("serie", CANAL, "2026-10")] = {"arquivo_base": RB, "versao": 1, "vazio": False, "arquivos": [
    F.arquivo_b64(RB + ":canal", "canal", rc_, "canal,tabela\n%s,x\n" % CANAL), F.arquivo_b64(RB + ":video", "video", rv_, "video\na\nb\n")]}
mj, ms = (c.caminho_manifesto("serie", "2026-10", 1, e)[1] for e in ("json", "sha256"))
k.site.manifestos[("serie", "2026-10")] = {"versao": 1, "arquivos": [
    F.arquivo_b64("m:serie:2026-10:v1:json", None, mj, '{"formato":1}'), F.arquivo_b64("m:serie:2026-10:v1:sha256", None, ms, "abc  x\n")]}
k.site.planos[("nas", None)] = plano(resumos=[{"classe": "serie", "canal": CANAL, "mes": "2026-10"}], manifestos=[{"classe": "serie", "mes": "2026-10"}])
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and all(os.path.isfile(k.em("numerico", x)) for x in (rc_, rv_, mj, ms)), "resumo (par) e manifesto gravados")
exige([len(lote) for lote in k.site.received] == [2, 2], "o par do resumo numa chamada só; o manifesto em outra (C6)")
exige(k.site.received[0][1]["linhas"] == 2 and k.site.received[1][0]["linhas"] is None, "linhas relidas no resumo; nulas no manifesto")
k.parar()
k = Caso()
k.site.resumos[("serie", CANAL, "2026-10")] = (409, "unidades_pendentes")
k.site.planos[("nas", None)] = plano(resumos=[{"classe": "serie", "canal": CANAL, "mes": "2026-10"}])
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and l["pulos"].get("resumo_unidades_pendentes") == 1, "resumo com unidades pendentes: espera, não é erro")
k.parar()

# ---------- 7. reconferência, aguardando o dono e sobra a apagar ----------
k = Caso()
ra, rb_, rcx = rel_u("serie", "competitor_video_daily", "2026-07"), rel_u("serie", "competitor_video_daily", "2026-08"), rel_u("serie", "competitor_video_daily", "2026-09")
os.makedirs(os.path.dirname(k.em("numerico", ra)))
open(k.em("numerico", ra), "wb").write(F.gz(CSV1))
os.makedirs(os.path.dirname(k.em("numerico", c.nome_recebendo(rcx))))
open(k.em("numerico", c.nome_recebendo(rcx)), "wb").write(F.gz(CSV1))
reconf = [item("unidade", "u:" + U1, "serie", "competitor_video_daily", "2026-07", 1, ra, "views"),
          item("unidade", "u:" + U2, "serie", "competitor_video_daily", "2026-08", 1, rb_, "views"),
          item("unidade", "u:" + U3, "serie", "competitor_video_daily", "2026-09", 1, rcx, "views"),
          dict(item("unidade", "u:" + U3, "serie", "competitor_video_daily", "2026-06", 1, ra, "views"))]
k.site.planos[("nas", None)] = plano(reconferir=reconf)
rc, l = k.rodar()
it = {i["arquivo_id"] + i.get("sha256", "")[:0]: i for a in k.site.attests for i in a["itens"]}
res = [i["resultado"] for a in k.site.attests for i in a["itens"]]
exige(res == ["presente", "ausente", "ausente"],
      "reconferência: presente, ausente (montado e com sentinela) e, só em _recebendo, AUSENTE (só o caminho final conta; X2 da r2.1)")
pres = [i for a in k.site.attests for i in a["itens"]][0]
exige(pres["linhas"] == 3 and pres["soma"] == "15" and pres["sha256"] == c.sha256_arquivo(k.em("numerico", ra))[0], "presente leva os três valores relidos")
exige(l["desfecho"] == "plano_invalido", "item com caminho que não bate com os componentes: plano_invalido (os outros seguem)")
k.parar()
k = Caso()
rd = rel_u("serie", "competitor_video_daily", "2026-05")
os.makedirs(os.path.dirname(k.em("numerico", c.nome_recebendo(rd))))
open(k.em("numerico", c.nome_recebendo(rd)), "wb").write(F.gz(CSV1))
ag = dict(item("unidade", "u:" + U1, "serie", "competitor_video_daily", "2026-05", 1, rd, "views"), b2_file_id_bom="4_z" + "0" * 24 + "_f001_x")
ag2 = dict(item("unidade", "u:" + U2, "serie", "competitor_video_daily", "2026-04", 1, rel_u("serie", "competitor_video_daily", "2026-04"), "views"), b2_file_id_bom=None)
sobra = rel_u("serie", "competitor_video_daily", "2026-03")
os.makedirs(os.path.dirname(k.em("numerico", c.nome_recebendo(sobra))), exist_ok=True)
open(k.em("numerico", c.nome_recebendo(sobra)), "wb").write(b"x")
fora = k.em("numerico", "importante.txt")
open(fora, "w").write("não apagar")
k.site.planos[("nas", None)] = plano(aguardando_dono=[ag, ag2], a_apagar=[{"filho": "numerico", "caminho": c.nome_recebendo(sobra)},
                                                                         {"filho": "numerico", "caminho": "importante.txt"}])
rc, l = k.rodar()
exige(os.path.isfile(k.em("numerico", rd)) and not os.path.exists(k.em("numerico", c.nome_recebendo(rd))),
      "aguardando o dono: achado em _recebendo, recebido, vai ao final (P24)")
exige([i["resultado"] for a in k.site.attests for i in a["itens"]] == ["ausente"], "aguardando o dono sem arquivo: ausente no attest (absent_first_at)")
exige(not os.path.exists(k.em("numerico", c.nome_recebendo(sobra))) and os.path.isfile(fora), "a_apagar: só a sobra em _recebendo; fora dela, nada")
exige(json.load(open(os.path.join(k.base, "estado", "aguardando_dono.json")))[0]["b2_file_id_bom"].startswith("4_z"), "aguardando_dono.json para a restauração")
k.parar()
k = Caso()
rd = rel_u("serie", "competitor_video_daily", "2026-05")
os.makedirs(os.path.dirname(k.em("numerico", c.nome_recebendo(rd))))
open(k.em("numerico", c.nome_recebendo(rd)), "wb").write(F.gz(CSV1))
k.site.recebido_resultado["u:" + U1] = "divergente"
k.site.planos[("nas", None)] = plano(aguardando_dono=[dict(item("unidade", "u:" + U1, "serie", "competitor_video_daily", "2026-05", 1, rd, "views"), b2_file_id_bom=None)])
rc, l = k.rodar()
exige(not os.path.exists(k.em("numerico", rd)) and os.path.isfile(k.em("numerico", c.nome_recebendo(rd))), "aguardando com divergente: fica em _recebendo")
k.parar()

# ---------- 8. canários antigos (P20) ----------
k = Caso()
pasta = k.em("numerico", "_canario")
os.makedirs(pasta)
h = date.fromisoformat(HOJE)
for nome in ((h - timedelta(days=31)).isoformat(), (h - timedelta(days=30)).isoformat(), "prova-m3a"):
    open(os.path.join(pasta, nome), "w").write("x")
k.site.planos[("nas", None)] = plano()
k.rodar()
exige(sorted(os.listdir(pasta)) == sorted([(h - timedelta(days=30)).isoformat(), HOJE, "prova-m3a"]), "apaga o canário de 31 dias; o de 30 e o prova-m3a ficam")
k.parar()

# ---------- 9. o plano: desligado, site fora, fora do contrato ----------
for rotulo, resp, desf in (("arquivo desligado", (503, {"error": {"code": "arquivo_desligado"}}), "arquivo_desligado"),
                           ("site fora", (502, {"error": {"code": "x"}}), "site_fora"),
                           ("chave recusada", (403, {"error": {"code": "FORBIDDEN"}}), "chave"),
                           ("vermelhos nulo", plano(vermelhos=None), "plano_invalido"),
                           ("sem reconferir", {k_: v for k_, v in plano().items() if k_ != "reconferir"}, "plano_invalido")):
    k = Caso()
    k.site.planos[("nas", None)] = resp
    rc, l = k.rodar()
    exige(rc == 1 and l["desfecho"] == desf, "%s: desfecho %s, nunca ok" % (rotulo, desf))
    exige(not os.path.exists(os.path.join(k.base, "estado", "plano.json")), "%s: plano.json não é gravado (o pulso vê o velho)" % rotulo)
    exige(not os.path.exists(k.em("numerico", "_canario")), "%s: nada gravado no NAS" % rotulo)
    k.parar()

# ---------- 10. varredura completa, página a página (item 172, parte da forja) ----------
k = Caso()
itens = []
for n, mes in enumerate(("2026-01", "2026-02", "2026-03")):
    r_ = rel_u("serie", "competitor_video_daily", mes)
    os.makedirs(os.path.dirname(k.em("numerico", r_)), exist_ok=True)
    open(k.em("numerico", r_), "wb").write(F.gz(CSV1))
    itens.append(item("unidade", "u:%08d-0000-4000-8000-000000000000" % n, "serie", "competitor_video_daily", mes, 1, r_, "views"))
k.site.planos[("nas", None)] = plano(modo="completo", cursor_seguinte="c2", reconferir=itens[:2])
k.site.planos[("nas", "c2")] = {"modo": "completo", "cursor_seguinte": None, "reconferir": itens[2:]}
rc, l = k.rodar()
lidos = [i["arquivo_id"] for a in k.site.attests for i in a["itens"]]
exige(lidos == [i["arquivo_id"] for i in itens], "completo: segue o cursor e relê todas as páginas, sem repetir nem pular")
exige(l["desfecho"] == "ok" and l["modo_plano"] == "completo", "completo: o modo vem do site")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano(modo="completo", cursor_seguinte="c2", reconferir=itens[:1])
k.site.planos[("nas", "c2")] = {"modo": "completo", "cursor_seguinte": None, "reconferir": itens[1:]}
orig_t = cp.Copiador.acabou_o_tempo
cp.Copiador.acabou_o_tempo = lambda self: setattr(self, "parcial", True) or True
rc, l = k.rodar()
cp.Copiador.acabou_o_tempo = orig_t
pedidos_plano = [p for p in k.site.srv.pedidos if p[1].endswith("/plan")]
exige(l["parcial"] is True and len(pedidos_plano) == 1, "orçamento esgotado: para, marca parcial e não pede a página seguinte (D-F6)")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano()
rc, l = k.rodar("completo")
exige(k.site.srv.pedidos[0][2] == {"completo": "1"} and l["modo"] == "completo", "--completo pede completo=1 e registra modo completo (o pulso não conta)")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano(cursor_seguinte="n2", reconferir=itens[:1])
k.site.planos[("nas", "n2")] = {"cursor_seguinte": None, "reconferir": itens[1:]}
rc, l = k.rodar()
exige([i["arquivo_id"] for a in k.site.attests for i in a["itens"]] == [i["arquivo_id"] for i in itens] and l["modo_plano"] == "normal",
      "modo normal com cursor: segue as páginas de reconferir também (C1 r2: paginado em qualquer modo)")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano()
k.site.ultimo_bom = time.time() - 3 * 86400
rc, l = k.rodar()
rotas = [p_[1].rsplit("/archive/", 1)[-1] for p_ in k.site.srv.pedidos]
exige(rotas[0] == "plan" and rotas[1] == "heartbeat" and l["modo_plano"] == "completo",
      "C2/crítico 3: casa desligada 3 dias, o primeiro pedido é o GET plan e a varredura abre (modo_plano completo)")
k.parar()

# ---------- 11. NAS cheio e alarme de 80% (itens 27 e 74) ----------
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
orig = c.gravar_atomico


def cheio(destino, dados, modo=0o644):
    if "/_recebendo/" in destino:
        raise OSError(errno.ENOSPC, "No space left on device")
    return orig(destino, dados, modo)


c.gravar_atomico = cheio
rc, l = k.rodar()
c.gravar_atomico = orig
exige(l["desfecho"] == "nas_cheio" and not os.path.exists(k.em("numerico", rel_u(*K1[:2]))) and recebidos(k) == [], "disco cheio: nas_cheio, nada no final, nada informado")
k.parar()
k = Caso()
K2 = ("serie", "competitor_video_daily", CANAL, "2026-09")
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.unidades[K2] = {"id": U2, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": m, "motivo": "nova"}
                                               for m in ("2026-10", "2026-09")])


def cheio2(destino, dados, modo=0o644):
    if "/_recebendo/" in destino and "2026-09" in destino:
        raise OSError(errno.ENOSPC, "No space left on device")
    return orig(destino, dados, modo)


c.gravar_atomico = cheio2
rc, l = k.rodar()
exige(l["desfecho"] == "nas_cheio" and [i["arquivo_id"] for i in recebidos(k)] == ["u:" + U1],
      "Yannis, importante 2: a primeira unidade, já no final, é informada mesmo com o NAS cheio na segunda")
rc, l = k.rodar()
c.gravar_atomico = orig
exige([i["arquivo_id"] for i in recebidos(k)][-1:] == ["u:" + U1] and l["contagens"].get("final_diferente", 0) == 0,
      "execução seguinte, NAS ainda cheio: o final existente é relido e informado, sem gravar nada em _recebendo")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano()
LIVRE[0] = 0.20
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and l["filhos"]["numerico"]["alerta_80"] is True,
      "80%: a linha marca alerta_80, mas o desfecho mede só a execução (X4 da r2.1: o vermelho é nas_80:<filho> do site)")
exige(k.site.batimentos[-1]["total_bytes"]["numerico"] == 4096000 and k.site.batimentos[-1]["livre_bytes"]["numerico"] == 819200,
      "o batimento leva livre e total do mesmo statvfs: o site calcula os 80% (nas_80:<filho>, C8 r2)")
LIVRE[0] = 0.21
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and l["filhos"]["numerico"]["alerta_80"] is False, "79%: ok")
LIVRE[0] = 0.5
k.parar()

# ---------- 12. prova, chave e defeito ----------
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar("prova")
exige(l["modo"] == "prova" and l["desfecho"] == "ok", "prova: linha com modo prova (o pulso não conta)")
exige([p[1].rsplit("/", 1)[-1] for p in k.site.srv.pedidos] == ["plan"], "prova: só o GET plan; nada exportado, recebido, atestado nem batimento")
exige(not os.path.exists(k.em("numerico", "_canario")) and not os.path.exists(os.path.join(k.base, "estado", "plano.json")), "prova: nada gravado no NAS nem o plano.json")
k.parar()
k = Caso()
os.unlink(os.path.join(k.base, "chaves", "copiador.chave"))
rc, l = k.rodar()
exige(l["desfecho"] == "chave" and k.site.srv.pedidos == [], "sem chave: desfecho chave e nenhum pedido")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano()
orig_c = cp.Copiador.canario
cp.Copiador.canario = lambda self, dia: 1 / 0
rc, l = k.rodar()
cp.Copiador.canario = orig_c
exige(l["desfecho"] == "bug" and l["erro"] == "ZeroDivisionError", "defeito no programa: linha com desfecho bug (vermelho), nunca silêncio")
k.parar()

k = Caso()
k.site.planos[("nas", None)] = plano()
orig_c = cp.Copiador.canario


def cortar(self, dia):
    self.n["antes_do_corte"] += 1
    raise c.Cortado()


cp.Copiador.canario = cortar
rc, l = k.rodar()
cp.Copiador.canario = orig_c
exige(l["desfecho"] == "timeout" and l["parcial"] is True and l["contagens"].get("antes_do_corte") == 1,
      "SIGTERM do timeout do cron: linha timeout com parcial e contagens, nunca silêncio (Yannis, importante 6)")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano()
rc, l = k.rodar(ARQ_ORCAMENTO_S="0")
exige(l["desfecho"] == "bug" and l["erro"] == "config ARQ_ORCAMENTO_S" and k.site.srv.pedidos == [],
      "ARQ_ORCAMENTO_S inválido: bug com o nome da variável, nenhum pedido (m4)")
k.parar()

# ---------- 14. o site no meio da execução, informe recusado, canário recusado, arquivo ilegível ----------
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
k.site.falhar["unit/received"] = (502, "x")
rc, l = k.rodar()
exige(l["desfecho"] == "site_fora" and l["parcial"] is True and "contagens" in l and len(k.site.attests) >= 1 and len(k.site.attests[0]["canarios"]) == 2,
      "502 no unit/received: site_fora com contagens, e o canário do dia já tinha chegado (Yannis I1, Phil I2), nunca bug")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
k.site.falhar["unit/received"] = (400, "VALIDATION_ERROR")
rc, l = k.rodar()
exige(l["desfecho"] == "informe_recusado" and l["pulos"].get("received_VALIDATION_ERROR") == 1,
      "400 VALIDATION_ERROR no unit/received: informe_recusado (vermelho), nunca ok (Phil I1, Yannis I8)")
k.parar()
k = Caso()
k.site.unidades[K1] = {"id": U1, "versao": 1, "partes": [CSV1], "coluna": "views"}
k.site.recebido_resultado["u:" + U1] = "desconhecido"
k.site.planos[("nas", None)] = plano(exportar=[{"classe": "serie", "tabela": "competitor_video_daily", "canal": CANAL, "mes": "2026-10", "motivo": "nova"}])
rc, l = k.rodar()
exige(l["desfecho"] == "informe_recusado", "unit/received com resultado desconhecido: informe_recusado")
k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano()
k.site.canario_recusar = {"texto"}
rc, l = k.rodar()
exige(l["desfecho"] == "controle_falhou" and l["contagens"].get("canario_recusado") == 1, "canário recusado pelo site (C7.1 r2): controle_falhou")
k.parar()
k = Caso()
rels = [rel_u("serie", "competitor_video_daily", m) for m in ("2026-01", "2026-02", "2026-03")]
for r_ in rels:
    os.makedirs(os.path.dirname(k.em("numerico", r_)), exist_ok=True)
    open(k.em("numerico", r_), "wb").write(F.gz(CSV1))
k.site.planos[("nas", None)] = plano(reconferir=[item("unidade", "u:%08d-0000-4000-8000-000000000000" % n, "serie", "competitor_video_daily",
                                                      r_.split("/")[-1][:7], 1, r_, "views") for n, r_ in enumerate(rels)])
orig_l = c.ler_arquivo


def eio(caminho, coluna, eh_csv):
    if "2026-02" in caminho:
        raise OSError(errno.EIO, "Input/output error")
    return orig_l(caminho, coluna, eh_csv)


c.ler_arquivo = eio
rc, l = k.rodar()
c.ler_arquivo = orig_l
res = [i["resultado"] for a in k.site.attests for i in a["itens"]]
exige(res == ["presente", "ilegivel", "presente"] and l["desfecho"] == "nas_ilegivel" and k.site.recusados_zod == [],
      "EIO num arquivo do meio: ilegivel (C7.1 r2) e os seguintes atestados; desfecho nas_ilegivel, nunca bug (Phil I2)")
k.parar()
for rotulo, kw in (("resumo vazio:false sem arquivos", {"resumos": [{"classe": "serie", "canal": CANAL, "mes": "2026-10"}]}),
                   ("manifesto com um arquivo só", {"manifestos": [{"classe": "serie", "mes": "2026-10"}]}),
                   ("prefixos_ausentes não vazio (M9)", {"prefixos_ausentes": ["x"]})):
    k = Caso()
    k.site.resumos[("serie", CANAL, "2026-10")] = {"arquivo_base": "s:" + U2, "versao": 1, "vazio": False, "arquivos": []}
    k.site.manifestos[("serie", "2026-10")] = {"versao": 1, "arquivos": [F.arquivo_b64("m:serie:2026-10:v1:json", None, mj, "{}")]}
    k.site.planos[("nas", None)] = plano(**kw)
    rc, l = k.rodar()
    exige(l["desfecho"] == "plano_invalido", "%s: plano_invalido, nunca calado (M2 do Phil)" % rotulo)
    k.parar()
k = Caso()
k.site.planos[("nas", None)] = plano()
os.makedirs(k.em("numerico", "_recebendo/serie/canais/%s/competitor_video_daily" % CANAL))
open(k.em("numerico", "_recebendo/serie/canais/%s/competitor_video_daily/2026-01.v1.csv.gz" % CANAL), "wb").write(b"x")
rc, l = k.rodar()
exige(l["contagens"].get("recebendo_arquivos") == 1, "sobras em _recebendo contadas na linha (M5 do Phil)")
k.parar()

# ---------- 13. variáveis com padrão (item 79) ----------
cf = c.config("copiador", c.ambiente("copiador", {"ARQ_ENV": "/nao/existe", "ARQ_RITMO_S": "0"}))
exige(cf["chave"] == "/opt/arquivo/chaves/copiador.chave" and cf["escrita"] == "/mnt/arquivo/escrita" and cf["orcamento_s"] == 2100,
      "copiador sem nenhuma variável: os padrões de produção")

print("\ncopiador: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_copiador.py`
Expected: `FileNotFoundError` em `copiador/copiar.py`, saída 1.

- [ ] **Step 3: Escrever o copiador**

`arquivo/copiador/copiar.py`:

```python
"""M3b (forja): o copiador do arquivo do site (spec 02 §9.4, §10.6, §10.10; contrato das rotas C1 a C8, r2).

Uso, na forja (cron: 03:17 e 15:17; 05 §16.5 com D-F1):
  /usr/bin/python3 -B /opt/arquivo/copiador/copiar.py --cron       a execução do cron (a única que o pulso conta)
  /usr/bin/python3 -B /opt/arquivo/copiador/copiar.py --prova      lê o plano e as montagens; não grava nem informa nada
                                                                   (o GET plan grava last_poll_at no site e pode abrir a varredura)
  /usr/bin/python3 -B /opt/arquivo/copiador/copiar.py --completo   pede ao site a varredura completa (02 §10.10), à mão

Quem decide é o site: o copiador baixa, grava em _recebendo, relê, confere contra o cabeçalho da MESMA resposta,
move com link+unlink (nunca sobrescreve) e informa o que releu. Nunca deduz 'nada devido' nem 'ausente': o que o
plano não trouxe não existe aqui. Pasta não montada ou sem a sentinela no filho: nada é gravado nem informado como
ausente naquele filho (nas_fora). Ordem: o PLANO antes do batimento (K3: o site mede o silêncio antes de o batimento
desta execução o apagar)."""
import argparse, base64, errno, hashlib, json, os, re, secrets, sys, time, traceback
from collections import Counter
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import comum as c  # noqa: E402
from cliente_site import ArquivoDesligado, ChaveRecusada, ErroDoSite, Recusa, Site, SiteFora  # noqa: E402

PROGRAMA = "copiador"
CANARIO_DIAS = 30                 # P20: o copiador apaga do NAS os canários com mais de 30 dias; os do B2 ficam (D-F4)
LOTE_RECEBIDO, LOTE_ATESTO = 100, 500
BONS = ("recebida", "ja_recebida")
ESPACO_CHEIO = (errno.ENOSPC, errno.EDQUOT)
# C3 r2: recusas da exportação que o plano não devia ter mandado, ou que o contrato chama de vermelho: desfecho
# `incompleto` (C9), com o código em `pulos`. canal_removido, mudou_durante_a_leitura e parte_mudou são esperados.
EXPORT_INCOMPLETO = frozenset({"unidade_retirada", "mes_fora_do_banco", "mes_aberto", "nao_devida", "grande_demais",
                               "faixa_invalida", "tabela_ausente"})
RESUMO_INCOMPLETO = frozenset({"ja_no_arquivo", "resumo_da_m10b", "grande_demais"})


class NasCheio(Exception):
    pass


class Diferente(Exception):
    """O que foi gravado e relido não é o que veio na resposta (ou o que veio não bate com o próprio cabeçalho)."""


def valores(caminho, coluna):
    """sha256, bytes, linhas e soma numa leitura só pelo NFS (M7). OSError (EIO) sobe: quem chamou decide."""
    return c.ler_arquivo(caminho, coluna, caminho.endswith(".csv.gz") or caminho.endswith(".csv.gz.parcial"))


class Copiador:
    def __init__(self, cf, site, modo, eh_montagem=os.path.ismount):
        self.cf, self.site, self.modo = cf, site, modo
        self.t0 = time.monotonic()
        self.filhos = {f: c.estado_filho(cf["escrita"], f, eh_montagem) for f in c.FILHOS}
        self.n = Counter()
        self.pulos = Counter()
        self.pendentes = []           # itens de unit/received ainda não enviados
        self.atestos = []             # itens de attest (fonte nas) ainda não enviados
        self.canarios = []            # os canários desta execução: vão no primeiro attest, logo depois de gravados
        self.cheio = self.invalido = self.parcial = self.incompleto = self.canario_recusado = False
        self.plano_id = None

    # ---------- utilidades ----------
    def ok(self, filho):
        e = self.filhos.get(filho)
        return bool(e and e["montado"] and e["sentinela"])

    def acabou_o_tempo(self):
        if time.monotonic() - self.t0 > self.cf["orcamento_s"]:
            self.parcial = True
        return self.parcial

    def batimento(self, ultimo_erro=None):
        try:
            self.site.dados("POST", "heartbeat", c.corpo_batimento(self.cf["base"], self.filhos, None, ultimo_erro))
        except ErroDoSite:
            self.n["batimento_falhou"] += 1     # não decide nada: o plano diz se o site está fora

    def gravar_recebendo(self, filho, rel, dados, esperado, coluna):
        """Confere os bytes contra o cabeçalho da resposta, grava em _recebendo, relê e confere de novo.
        Devolve o caminho em _recebendo e os valores relidos. Nada aqui toca o caminho final.
        Parte de unidade (C3 r2): a soma NÃO é comparada (o cabeçalho vem vazio); linhas e sha256, sim."""
        if hashlib.sha256(dados).hexdigest() != esperado["sha256"] or len(dados) != esperado["bytes"]:
            raise Diferente("transporte")
        parcial = os.path.join(self.filhos[filho]["raiz"], c.nome_recebendo(rel))
        try:
            if os.path.lexists(parcial):
                os.unlink(parcial)            # sobra de uma execução cortada: refeita (02 §10.6, religamento)
            c.gravar_atomico(parcial, dados)
        except OSError as e:
            if e.errno in ESPACO_CHEIO:
                self.cheio = True
                raise NasCheio()
            raise
        v = valores(parcial, coluna)
        if (v["sha256"], v["bytes"]) != (esperado["sha256"], esperado["bytes"]) or \
           (esperado.get("linhas") is not None and v["linhas"] != esperado["linhas"]) or \
           (esperado.get("partes", 1) == 1 and rel.endswith(".csv.gz") and v["soma"] != esperado.get("soma")):
            os.unlink(parcial)
            raise Diferente("releitura")
        return parcial, v

    def ja_no_final(self, filho, rel, coluna, sha_esperado):
        """Destino existente nunca é sobrescrito (item 27): o que se informa é o final relido (o site conclui)."""
        fv = valores(os.path.join(self.filhos[filho]["raiz"], rel), coluna)
        if fv["sha256"] != sha_esperado:
            self.n["final_diferente"] += 1
        return fv

    def mover(self, filho, rel, parcial, v, coluna):
        """link + unlink para o caminho final: falha se o destino existe (m5: nunca há janela entre conferir e trocar).
        Com o destino existente, a sobra sai e o que se informa é o final relido."""
        final = os.path.join(self.filhos[filho]["raiz"], rel)
        os.makedirs(os.path.dirname(final), exist_ok=True)
        try:
            os.link(parcial, final)
        except FileExistsError:
            os.unlink(parcial)
            return self.ja_no_final(filho, rel, coluna, v["sha256"])
        os.unlink(parcial)
        c._fsync_pasta(os.path.dirname(final))
        return v

    # ---------- informes ----------
    def enviar_recebidos(self, itens=None):
        lote = itens if itens is not None else self.pendentes
        if itens is None:
            self.pendentes = []
        resultado = {}
        while lote:
            parte, lote = lote[:LOTE_RECEBIDO], lote[LOTE_RECEBIDO:]
            try:
                d = self.site.dados("POST", "unit/received", {"itens": parte})
            except Recusa as e:
                self.pulos["received_" + (e.code or str(e.status))] += len(parte)
                continue
            for r in d.get("itens", []):
                resultado[r.get("arquivo_id")] = r.get("resultado")
                self.n["recebido_" + str(r.get("resultado"))] += 1
            self.n["meses_selados"] += len(d.get("selados") or [])
        return resultado

    def enviar_atestos(self, final=False):
        while self.atestos or self.canarios or final:
            parte, self.atestos = self.atestos[:LOTE_ATESTO], self.atestos[LOTE_ATESTO:]
            corpo = {"fonte": "nas", "plano_id": self.plano_id,
                     "filhos": {f: {"montado": self.filhos[f]["montado"], "sentinela": self.filhos[f]["sentinela"]} for f in c.FILHOS},
                     "canarios": self.canarios, "itens": parte}
            try:
                d = self.site.dados("POST", "attest", corpo)
                for r in d.get("itens", []):
                    self.n["atesto_" + str(r.get("resposta"))] += 1
                for r in d.get("canarios") or []:           # C7.1 r2: canário recusado = controle_falhou no copiador
                    self.n["canario_" + str(r.get("resposta"))] += 1
                    if r.get("resposta") != "aceito":
                        self.canario_recusado = True
            except Recusa as e:
                self.pulos["attest_" + (e.code or str(e.status))] += max(len(parte), 1)
            self.canarios, final = [], False

    # ---------- passos ----------
    def canario(self, dia):
        """P20/D-F4: um canário por dia em cada filho montado com sentinela; se já existe (segunda execução do dia),
        não regrava: relê e informa o sha256 dele (C1 r2). Os com mais de 30 dias saem do NAS."""
        hoje = date.fromisoformat(dia)
        for f in c.FILHOS:
            if not self.ok(f):
                continue
            pasta = os.path.join(self.filhos[f]["raiz"], "_canario")
            alvo = os.path.join(pasta, dia)
            try:
                if not os.path.exists(alvo):
                    c.gravar_atomico(alvo, (secrets.token_hex(32) + "\n").encode())
                    self.n["canario_gravado"] += 1
            except OSError as e:
                if e.errno in ESPACO_CHEIO:
                    self.cheio = True
                    continue
                raise
            self.canarios.append({"filho": f, "dia": dia, "sha256": c.sha256_arquivo(alvo)[0]})
            for nome in os.listdir(pasta):
                if c.RE_DIA.match(nome) and date.fromisoformat(nome) < hoje - timedelta(days=CANARIO_DIAS):
                    os.unlink(os.path.join(pasta, nome))
                    self.n["canario_apagado"] += 1

    def exportar(self, item):
        classe, tabela, canal, mes = item["classe"], item["tabela"], item["canal"], item["mes"]
        filho = c.CLASSES[classe]
        c.caminho_unidade(classe, canal, tabela, mes, 1)        # valida antes de pedir (D-F11)
        if not self.ok(filho):
            self.n["pulada_nas_fora"] += 1
            return
        corpo, parte, baixadas, transporte = {"classe": classe, "tabela": tabela, "canal": canal, "mes": mes}, 1, [], 0

        def descartar():
            for f_, rel_, p_, v_, a_ in baixadas:
                if p_:
                    os.unlink(p_)
        while True:
            try:
                r = self.site.pedir("POST", "unit/export", corpo)
            except Recusa as e:
                descartar()                 # parte_mudou e qualquer recusa no meio: as partes já baixadas saem
                if e.code == "classe_tabela_invalida":
                    self.invalido = True
                elif e.code in EXPORT_INCOMPLETO:
                    self.incompleto = True
                self.pulos[e.code or str(e.status)] += 1
                return
            if r.cabecalhos.get("content-type", "").startswith("application/json"):
                d = r.json().get("data") or {}
                if d.get("vazia") is True and d.get("linhas") == 0:
                    self.n["vazia"] += 1        # unidade vazia conferida: terminal, sem arquivo
                else:
                    self.invalido = True
                return
            h = r.cabecalhos
            try:
                versao, partes, p = int(h["x-arquivo-versao"]), int(h["x-arquivo-partes"]), int(h["x-arquivo-parte"])
                _, rel = c.caminho_unidade(classe, canal, tabela, mes, versao, p if partes > 1 else None)
                aid = h["x-arquivo-id"]
                id_certo = re.fullmatch(r"p:[0-9a-f-]{36}:%02d" % p, aid) if partes > 1 else re.fullmatch(r"u:[0-9a-f-]{36}", aid)
                if rel != h.get("x-arquivo-caminho") or p != parte or not id_certo or not c.RE_UUID.match(aid.split(":")[1]):
                    raise c.CaminhoInvalido(h.get("x-arquivo-caminho"))
                if partes > 1 and h.get("x-arquivo-soma"):
                    raise c.CaminhoInvalido("parte com X-Arquivo-Soma preenchido (C3: vem vazio em toda parte)")
                coluna = h.get("x-arquivo-coluna-controle") or None
                esperado = {"sha256": h["x-arquivo-sha256"], "bytes": int(h["x-arquivo-bytes"]), "partes": partes,
                            "linhas": int(h["x-arquivo-linhas"]), "soma": h.get("x-arquivo-soma") or None}
            except (KeyError, ValueError, IndexError, c.CaminhoInvalido):
                self.invalido = True
                descartar()
                return
            if os.path.lexists(os.path.join(self.filhos[filho]["raiz"], rel)):
                # Yannis, importante 2: o final já existe (execução anterior que moveu e não informou, ou outra versão):
                # nada vai a _recebendo (com o NAS cheio, nem caberia); relê o final e o informa.
                baixadas.append((filho, rel, None, self.ja_no_final(filho, rel, coluna, esperado["sha256"]), aid))
            else:
                try:
                    caminho_parcial, v = self.gravar_recebendo(filho, rel, r.corpo, esperado, coluna)
                except Diferente as e:
                    transporte += 1
                    self.n["diferente_" + str(e)] += 1
                    if transporte < 2:
                        continue                    # pede de novo, uma vez
                    descartar()
                    self.n["unidade_falhou"] += 1
                    return
                baixadas.append((filho, rel, caminho_parcial, v, aid))
            if parte >= partes:
                break
            parte += 1
            corpo = dict(corpo, parte=parte)
        for f_, rel_, p_, v_, a_ in baixadas:   # só com todas as partes conferidas em _recebendo
            fv = self.mover(f_, rel_, p_, v_, coluna) if p_ else v_
            self.pendentes.append(dict(fv, arquivo_id=a_))
        self.n["exportada"] += 1
        if len(self.pendentes) >= LOTE_RECEBIDO:
            self.enviar_recebidos()             # m10: não guarda o informe até o fim da fase

    def gravar_conjunto(self, arquivos, montar):
        """Resumo (par ou trio) e manifesto: conteúdo em base64 na resposta. Tudo em _recebendo, depois tudo para o final."""
        prontos = []
        for a in arquivos:
            filho, rel = montar(a)
            if rel != a.get("caminho"):
                raise c.CaminhoInvalido(a.get("caminho"))
            dados = base64.b64decode(a["conteudo_base64"], validate=True)
            esperado = {"sha256": a["sha256"], "bytes": a["bytes"], "linhas": a.get("linhas"), "soma": None}
            if not self.ok(filho):
                self.n["pulada_nas_fora"] += 1
                for f_, rel_, p_, v_, a_ in prontos:
                    os.unlink(p_)
                return None
            if os.path.lexists(os.path.join(self.filhos[filho]["raiz"], rel)):
                prontos.append((filho, rel, None, self.ja_no_final(filho, rel, None, a["sha256"]), a["arquivo_id"]))
                continue
            p, v = self.gravar_recebendo(filho, rel, dados, esperado, None)
            prontos.append((filho, rel, p, v, a["arquivo_id"]))
        return [dict(self.mover(f_, rel_, p_, v_, None) if p_ else v_, arquivo_id=a_) for f_, rel_, p_, v_, a_ in prontos]

    def resumo(self, item):
        classe, canal, mes = item["classe"], item["canal"], item["mes"]
        try:
            d = self.site.dados("POST", "month/summary", {"classe": classe, "canal": canal, "mes": mes})
        except Recusa as e:
            if e.code in RESUMO_INCOMPLETO:
                self.incompleto = True
            self.pulos["resumo_" + (e.code or str(e.status))] += 1
            return
        arquivos = d.get("arquivos")
        if d.get("vazio") is True and arquivos == []:
            self.n["resumo_vazio"] += 1
            return
        if d.get("vazio") is not False or not isinstance(arquivos, list) or not arquivos:
            raise c.CaminhoInvalido("resumo fora do C4 (vazio/arquivos)")      # M2c do Phil: nunca passa calado
        versao = d.get("versao")

        def montar(a):
            papel = a.get("papel")
            if a.get("arquivo_id") != "%s:%s" % (d.get("arquivo_base"), papel):
                raise c.CaminhoInvalido(a.get("arquivo_id"))
            return c.caminho_resumo(classe, canal, mes, versao, papel)
        itens = self.gravar_conjunto(arquivos, montar)
        if itens:
            self.enviar_recebidos(itens)         # o par (ou o trio) de um canal numa chamada só (C6)
            self.n["resumo"] += 1

    def manifesto(self, item):
        classe, mes = item["classe"], item["mes"]
        try:
            d = self.site.dados("POST", "month/manifest", {"classe": classe, "mes": mes})
        except Recusa as e:
            self.pulos["manifesto_" + (e.code or str(e.status))] += 1
            return
        versao = d.get("versao")
        arquivos = d.get("arquivos")
        if not isinstance(arquivos, list) or sorted(str(a.get("arquivo_id", "")).rsplit(":", 1)[-1] for a in arquivos) != ["json", "sha256"]:
            raise c.CaminhoInvalido("manifesto sem exatamente o .json e o .sha256 (C5)")

        def montar(a):
            ext = "json" if str(a.get("arquivo_id", "")).endswith(":json") else "sha256"
            if a.get("arquivo_id") != "m:%s:%s:v%s:%s" % (classe, mes, versao, ext):
                raise c.CaminhoInvalido(a.get("arquivo_id"))
            return c.caminho_manifesto(classe, mes, versao, ext)
        itens = self.gravar_conjunto(arquivos, montar)
        if itens:
            self.enviar_recebidos(itens)
            self.n["manifesto"] += 1

    def reler(self, item, aceitar_recebendo=False):
        """Reconferência (C7.1): presente com os três valores relidos, ausente (só com o filho montado e a sentinela),
        nas_fora, ou ilegivel (erro de E/S do disco: I2 do Phil, C7.1 r2). Na reconferência só o caminho final
        conta: arquivo só em _recebendo é ausente (X2 da r2.1; a forma que não pede campo novo).
        Em aguardando_dono (aceitar_recebendo=True) procura nos dois lugares."""
        filho, rel = c.caminho_do_item(item)
        if not self.ok(filho):
            return {"arquivo_id": item["arquivo_id"], "resultado": "nas_fora"}, None
        raiz = self.filhos[filho]["raiz"]
        lugares = [os.path.join(raiz, rel)] + ([os.path.join(raiz, c.nome_recebendo(rel))] if aceitar_recebendo else [])
        for onde in lugares:
            if os.path.isfile(onde):
                try:
                    v = valores(onde, item.get("coluna_controle"))
                except OSError:
                    self.n["ilegivel"] += 1
                    return {"arquivo_id": item["arquivo_id"], "resultado": "ilegivel"}, None
                return dict(v, arquivo_id=item["arquivo_id"], resultado="presente"), onde
        return {"arquivo_id": item["arquivo_id"], "resultado": "ausente"}, None

    def aguardando(self, item):
        """Unidade 'aguardando arquivo do dono' (C1): procurar no NAS ou em _recebendo e informar em unit/received;
        o que estava em _recebendo só vai para o final se o site disser recebida. Não achado: ausente, no attest."""
        filho, rel = c.caminho_do_item(item)
        r, onde = self.reler(item, aceitar_recebendo=True)
        if r["resultado"] != "presente":
            self.atestos.append(r)
            return
        informe = {k: r[k] for k in ("arquivo_id", "sha256", "bytes", "linhas", "soma")}
        res = self.enviar_recebidos([informe]).get(item["arquivo_id"])
        if res in BONS and onde.endswith(c.nome_recebendo(rel)):
            final = os.path.join(self.filhos[filho]["raiz"], rel)
            os.makedirs(os.path.dirname(final), exist_ok=True)
            try:
                os.link(onde, final)
            except FileExistsError:
                return                          # o final apareceu: fica; a sobra sai pelo a_apagar ou pela reexportação
            os.unlink(onde)
            self.n["restaurado_movido"] += 1

    def apagar_sobra(self, item):
        rel = c.de_recebendo(item["caminho"])
        if c.CLASSES[rel.split("/", 1)[0]] != item["filho"]:
            raise c.CaminhoInvalido(item["caminho"])
        if not self.ok(item["filho"]):
            return
        alvo = os.path.join(self.filhos[item["filho"]]["raiz"], item["caminho"])
        if os.path.isfile(alvo):
            os.unlink(alvo)
            self.n["sobra_apagada"] += 1

    def contar_recebendo(self):
        """M5 do Phil: sobras em _recebendo (as de versão que mudou nunca saem pelo a_apagar). Só conta."""
        for f in c.FILHOS:
            if self.ok(f):
                raiz = os.path.join(self.filhos[f]["raiz"], "_recebendo")
                self.n["recebendo_arquivos"] += sum(len(fs) for _, _, fs in os.walk(raiz))


def validar_plano(d):
    ok = (isinstance(d, dict) and isinstance(d.get("plano_id"), str) and c.RE_UUID.match(d["plano_id"])
          and d.get("modo") in ("normal", "completo") and isinstance(d.get("vermelhos"), list)
          and all(isinstance(v, str) for v in d["vermelhos"])
          and isinstance(d.get("canario"), dict) and c.RE_DIA.match(str(d["canario"].get("dia", "")))
          and all(isinstance(d.get(k), list) for k in ("exportar", "resumos", "manifestos", "aguardando_dono", "a_apagar", "reconferir"))
          and d.get("prefixos_ausentes") == [])      # M2d do Phil: a M9 obriga a atualizar o kit (vermelho de propósito)
    if not ok:
        raise c.CaminhoInvalido("plano fora do contrato C1")
    return d


def desfecho_de(cp):
    """C9 r2, do mais grave para o menos. Todo desfecho fora de `ok` é vermelho no pulso."""
    pulos_informe = any(k.startswith(("received_", "attest_")) for k in cp.pulos)
    if cp.cheio:
        return "nas_cheio"
    if cp.canario_recusado:
        return "controle_falhou"
    if not all(cp.ok(f) for f in c.FILHOS):
        return "nas_fora"
    if cp.n["ilegivel"]:
        return "nas_ilegivel"
    if cp.invalido:
        return "plano_invalido"
    if cp.n["unidade_falhou"]:
        return "unidade_falhou"
    if pulos_informe or cp.n["recebido_desconhecido"] or cp.n["atesto_recusado"]:
        return "informe_recusado"
    if cp.incompleto:
        return "incompleto"              # X5 da r2.1: mes_aberto e nao_devida pulados são vermelhos
    # X4 da r2.1: o alarme de 80% NÃO é desfecho do copiador (cegaria a verificação da execução por semanas, I5 do
    # Phil); o batimento leva total_bytes e o site põe nas_80:<filho> em vermelhos. A linha guarda uso e alerta_80.
    return "ok"


def executar(cf, site, modo, eh_montagem=os.path.ismount):
    cp = Copiador(cf, site, modo, eh_montagem)
    linha = {"modo": modo, "filhos": {f: {"montado": cp.filhos[f]["montado"], "sentinela": cp.filhos[f]["sentinela"],
                                          "uso": cp.filhos[f]["uso"], "alerta_80": c.alerta_80(cp.filhos[f])} for f in c.FILHOS}}
    consulta = {"completo": "1"} if modo == "completo" else None
    try:                                       # K3: o plano ANTES do batimento (o site mede o silêncio primeiro)
        plano = validar_plano(site.dados("GET", "plan", consulta=consulta))
    except ArquivoDesligado:
        return dict(linha, desfecho="arquivo_desligado")
    except ChaveRecusada:
        return dict(linha, desfecho="chave")
    except (SiteFora, ErroDoSite) as e:
        return dict(linha, desfecho="site_fora", erro=str(e)[:200])
    except c.CaminhoInvalido:
        if modo != "prova":
            cp.batimento("plano_invalido")
        return dict(linha, desfecho="plano_invalido")
    cp.plano_id = plano["plano_id"]
    linha.update(plano_id=cp.plano_id, modo_plano=plano["modo"], primeira_selagem=plano.get("primeira_selagem"))
    if modo == "prova":
        print("PROVA: plano %s (%s): exportar %d, resumos %d, manifestos %d, aguardando %d, a_apagar %d, reconferir %d; vermelhos %d"
              % (cp.plano_id, plano["modo"], len(plano["exportar"]), len(plano["resumos"]), len(plano["manifestos"]),
                 len(plano["aguardando_dono"]), len(plano["a_apagar"]), len(plano["reconferir"]), len(plano["vermelhos"])))
        for f in c.FILHOS:
            print("PROVA: %s montado=%s sentinela=%s livre=%s" % (f, cp.filhos[f]["montado"], cp.filhos[f]["sentinela"], cp.filhos[f]["livre_bytes"]))
        return dict(linha, desfecho="ok" if all(cp.ok(f) for f in c.FILHOS) else "nas_fora")
    cp.batimento()
    c.gravar_plano(cf["plano"], plano["vermelhos"])
    # Para o restaurar_do_b2 --do-plano (P24): os itens que esperam o dono, com o fileId da última conferência boa.
    c.trocar_atomico(os.path.join(cf["estado"], "aguardando_dono.json"), json.dumps(plano["aguardando_dono"]).encode(), 0o600)
    erro_site, cortado = None, False
    try:
        cp.canario(plano["canario"]["dia"])
        cp.enviar_atestos(final=True)          # Yannis, importante 1: o canário do dia chega ao site antes de tudo
        passos = ([(cp.apagar_sobra, i) for i in plano["a_apagar"]] + [(cp.exportar, i) for i in plano["exportar"]])
        try:
            for fn, item in passos:
                if cp.acabou_o_tempo() or cp.cheio:
                    break
                try:
                    fn(item)
                except (c.CaminhoInvalido, KeyError, TypeError, ValueError):
                    cp.invalido = True
        finally:
            cp.enviar_recebidos()              # Yannis, importante 2: o que já está no final é informado mesmo com o NAS cheio
        for fn, lista in ((cp.resumo, plano["resumos"]), (cp.manifesto, plano["manifestos"]), (cp.aguardando, plano["aguardando_dono"])):
            for item in lista:
                if cp.acabou_o_tempo() or cp.cheio:
                    break
                try:
                    fn(item)
                except (c.CaminhoInvalido, KeyError, TypeError, ValueError):
                    cp.invalido = True
    except NasCheio:
        pass
    except ArquivoDesligado:
        erro_site = "arquivo_desligado"
    except ChaveRecusada:
        erro_site = "chave"
    except ErroDoSite:
        erro_site = "site_fora"
    except c.Cortado:
        cortado = True
    pagina = plano
    try:
        while erro_site is None and not cortado:   # reconferência, página a página em qualquer modo (C1 r2)
            for item in pagina["reconferir"]:
                if cp.acabou_o_tempo():
                    break
                try:
                    r, _ = cp.reler(item)
                    cp.atestos.append(r)
                    cp.n["relido_" + r["resultado"]] += 1
                except c.CaminhoInvalido:
                    cp.invalido = True
                if len(cp.atestos) >= LOTE_ATESTO:
                    cp.enviar_atestos()
            cp.enviar_atestos()
            cursor = pagina.get("cursor_seguinte")
            if not cursor or cp.acabou_o_tempo():
                break
            try:
                pagina = site.dados("GET", "plan", consulta=dict(consulta or {}, cursor=cursor))
                if not isinstance(pagina.get("reconferir"), list):
                    raise c.CaminhoInvalido("página sem reconferir")
                cp.n["pagina"] += 1
            except (c.CaminhoInvalido, Recusa):
                cp.invalido = True
                break
        cp.contar_recebendo()
    except ArquivoDesligado:
        erro_site = "arquivo_desligado"
    except ChaveRecusada:
        erro_site = "chave"
    except ErroDoSite:
        erro_site = "site_fora"
    except c.Cortado:
        cortado = True
    if not cortado:
        cp.batimento(erro_site)
    if cortado:
        desfecho = "timeout"
    elif erro_site:
        desfecho = erro_site
    else:
        desfecho = desfecho_de(cp)
    return dict(linha, desfecho=desfecho, parcial=cp.parcial or cortado or erro_site is not None,
                contagens=dict(cp.n), pulos=dict(cp.pulos))


def main(argv=None, env=None, eh_montagem=os.path.ismount):
    a = argparse.ArgumentParser(description="copiador do arquivo (M3b)")
    g = a.add_mutually_exclusive_group(required=True)
    for m in ("cron", "prova", "completo"):
        g.add_argument("--" + m, dest="modo", action="store_const", const=m)
    modo = a.parse_args(argv).modo
    cf = c.config(PROGRAMA, c.ambiente(PROGRAMA, env))
    t0 = time.monotonic()
    try:
        c.instalar_sigterm()
        chave = c.ler_chave(cf["chave"])
        if cf["erro_config"]:
            linha = {"modo": modo, "desfecho": "bug", "erro": cf["erro_config"]}
        elif chave is None:
            linha = {"modo": modo, "desfecho": "chave"}
        else:
            linha = executar(cf, Site(cf["site"], chave, intervalo=cf["ritmo_s"]), modo, eh_montagem)
    except c.Cortado:
        linha = {"modo": modo, "desfecho": "timeout", "parcial": True}
    except Exception as e:
        traceback.print_exc()
        linha = {"modo": modo, "desfecho": "bug", "erro": type(e).__name__}
    linha["duracao_s"] = round(time.monotonic() - t0, 1)
    c.registrar(cf["log"], linha)
    print("copiador: %s" % linha["desfecho"])
    return 0 if linha["desfecho"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_copiador.py 2>/dev/null | tail -1`
Expected: `copiador: 0 falha(s)` (o caso "defeito no programa" imprime um traceback de `ZeroDivisionError` no stderr: é o esperado). Leva cerca de 30 s (cada caso sobe e derruba um servidor).

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/copiador/copiar.py arquivo/falsos.py arquivo/teste_copiador.py
git -C $K commit -m "feat: arquivo M3b, o copiador (plano antes do batimento, grava em _recebendo, relê, nunca sobrescreve, canário primeiro, desfechos que não mentem)" -- arquivo/copiador/copiar.py arquivo/falsos.py arquivo/teste_copiador.py
```

---

### Task 4: o `conferir-b2`

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/conferir-b2/conferir.py`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_conferir_b2.py`

**Interfaces:**
- Consumes: contrato r2.2: C2 (`GET plan?fonte=b2`: `execucao_id` igual em todas as páginas, `retomado_de` e `cobertura` do `--completo` retomado pelo site entre execuções, `estado` por filho decidido pelo site, `teto_bytes_dia`, `teto_bytes_mes`, `controle_negativo`, `canarios` sempre dois com caminho nulo quando o site ainda não conhece canário de 6 horas daquele filho, `arquivos` até 500 por página, validade de 2 h por página, X1), C7.2 (`attest` fonte `b2`, 1..200 itens, `tentativa`, `repetir`, `nao_decifra`, controle negativo presente sem sha256, `execucao.estado`, `canario_ok` por filho, `execucao_vencida`), C8 (`parado_no_teto`; a resposta traz `teto` em `verde`/`ambar`/`vermelho`, contado pelo site); `b2.py` e `comum.py`; a interface da M3a para `conferir-b2.jsonl` (`pedidos`, `informados`, `estado`).
- Produces: `conferir.main(argv, env, rclone=None, b2_base) -> int` (sem `rclone`, `b2.rclone_padrao`); o registro `/opt/arquivo/log/conferir-b2.jsonl` (desfechos da D-F19; mais `estados` do site, `canario_ok`, `teto` em `dia`/`mes` quando parou nele, `teto_cor` (a cor que o batimento devolveu, ou `null`), `retomado_de` e `cobertura` (r2.2), `rclone` usado, `tmp_limpo`; `estado: "aguardando_primeira_selagem"` ou `"nada_devido"` só com `pedidos: 0` e copiado do `estado` do site, nunca deduzido); `/opt/arquivo/estado/conferir-b2-bytes.json` (`dia`, `bytes_dia`, `mes`, `bytes_mes`).

**A ordem de uma execução:** apaga `estado/conferir-b2-*` que uma execução morta deixou → variável `OBS_ARQUIVO_CONFERIR_B2=on` → `rclone config dump` (crypt sobre `b2arq:`) → `GET plan?fonte=b2` → autorizar no B2 (`b2api/v4`) → controle negativo (listagem) e os dois canários (listagem, download pelo `fileId`, decifrar, sha256) → **primeiro informe, só os três** → com `controle_ok` do site, os três certos aqui e `canario_ok` do filho de todo `nada_devido`: os arquivos, por (filho, classe, mês), em lotes de 200, com `repetir` baixado de novo uma vez; `execucao_vencida` pede o plano de novo no cursor da última página aceita (X1) → linha do registro → batimento (com `parado_no_teto`).

**O que acontece quando o dado não existe:** plano sem arquivo: `ok` com `pedidos: 0` **só** com o `estado` que o site mandou (`aguardando_primeira_selagem` ou `nada_devido`, este com o canário do mesmo filho aceito agora; sem isso, `controle_falhou`); `com_pedidos` sem arquivo: a linha sai sem `estado` e o pulso fica vermelho (`pedidos-0-sem-estado`); `nada_devido` com arquivo do filho: `plano_invalido`; canário que o site ainda não conhece (caminho nulo) ou que não está no B2: `ausente`, `controle_falhou`, nada mais é informado; arquivo que não está no B2: `ausente` só com a listagem 200 sem versão viva, e o site decide entre `aguardando_b2` e `arquivo_ausente` pelo `received_at`; variável ausente: `desligado`, sem pedido nenhum. **Quando dá erro:** B2 fora: `sem_acesso` nos três controles, nenhum `ausente`; 403 `download_cap_exceeded` ou erro de download repetido num arquivo: `sem_acesso` naquele arquivo e desfecho `sem_acesso`; controle negativo presente: `controle_falhou`; não decifra: `nao_decifra` (o site retira); teto de bytes do dia ou do mês: para de baixar, informa o que já veio, `teto_bytes`, com a cor que o site devolveu no batimento (âmbar no primeiro dia, vermelho no segundo seguido; batimento que falha ou cor fora da lista: `teto_cor: null`, que o pulso lê como vermelho); orçamento: `parcial`, `incompleto`; `--completo` que não termina: a execução seguinte recebe o plano já retomado do site (`retomado_de`), e `cobertura` ausente ou incoerente é `plano_invalido`; site fora no meio: `site_fora` com as contagens; `SIGTERM`: `timeout`.

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_conferir_b2.py`:

```python
"""M3b: prova o conferir-b2 (item 132, parte do kit; item 134, canário por filho; P59) contra o site falso,
o B2 falso e o rclone falso. Uso: python3 teste_conferir_b2.py"""
import importlib.util, json, os, sys, tempfile
from datetime import datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import comum as c  # noqa: E402
import falsos as F  # noqa: E402

spec = importlib.util.spec_from_file_location("conferir", os.path.join(AQUI, "conferir-b2", "conferir.py"))
cb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cb)

falhas = []
CANAL = "0b6f3c2e-6a51-4c1e-9d0e-6f2b1a7c9e10"
U1, U2 = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
EXEC = "eeeeeeee-0000-4000-8000-000000000001"
CSV1 = "id,views\n1,10\n2,\n3,5\n"
SENHA = "s3nh4"


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def rel(mes):
    return c.caminho_unidade("serie", CANAL, "competitor_video_daily", mes, 1)[1]


def item(uid, mes):
    return {"arquivo_id": "u:" + uid, "tipo": "unidade", "filho": "numerico", "caminho": rel(mes), "classe": "serie",
            "tabela": "competitor_video_daily", "canal": CANAL, "mes": mes, "versao": 1, "coluna_controle": "views"}


def plano(**kw):
    d = {"execucao_id": EXEC, "gerado_em": "x", "modo": "normal", "cursor_seguinte": None, "primeira_selagem": "2026-10",
         "vermelhos": [], "teto_bytes_dia": 10 ** 9, "teto_bytes_mes": 10 ** 10,
         "estado": {"numerico": "com_pedidos", "texto": "com_pedidos"},
         "controle_negativo": {"arquivo_id": "controle_negativo", "filho": "numerico", "caminho": "_controle/nao-existe-7f3a"},
         "canarios": [{"arquivo_id": "canario:numerico", "filho": "numerico", "caminho": "_canario/2026-11-27"},
                      {"arquivo_id": "canario:texto", "filho": "texto", "caminho": "_canario/2026-11-27"}],
         "arquivos": [], "prefixos_ausentes": [], "retomado_de": None, "cobertura": None}
    d.update(kw)
    if d["modo"] == "completo" and "cobertura" not in kw:
        d["cobertura"] = {"paginas_aceitas": 0, "paginas_total": 1}     # C2 r2.2: no completo, a cobertura nunca é nula
    return d


def resposta_padrao(repetir=(), canario_ok=None):
    """O site do C7.2 r2: estado da execução, negativo_ok e canario_ok por filho."""
    vistos = set()

    def r(corpo):
        ids = [i["arquivo_id"] for i in corpo["itens"]]
        if "controle_negativo" in ids:
            neg = [i for i in corpo["itens"] if i["arquivo_id"] == "controle_negativo"][0]
            can = {i["arquivo_id"].split(":")[1]: i["resultado"] == "presente" for i in corpo["itens"] if i["arquivo_id"].startswith("canario:")}
            if canario_ok is not None:
                can = dict(can, **canario_ok)
            ok = neg["resultado"] == "ausente" and len(can) == 2 and all(can.values())
            return {"execucao": {"estado": "controle_ok" if ok else "controle_falhou", "negativo_ok": neg["resultado"] == "ausente",
                                 "canario_ok": can},
                    "itens": [{"arquivo_id": a, "resposta": "aceito"} for a in ids]}
        out = []
        for i in corpo["itens"]:
            rep = i["arquivo_id"] in repetir and i["arquivo_id"] not in vistos
            vistos.add(i["arquivo_id"])
            out.append({"arquivo_id": i["arquivo_id"], "resposta": "repetir" if rep else "aceito"})
        return {"execucao": {"estado": "controle_ok"}, "itens": out}
    return r


class Caso:
    def __init__(self, dump=None, sem_switch=False):
        self.tmp = tempfile.mkdtemp(prefix="conferir-")
        self.base = os.path.join(self.tmp, "opt")
        os.makedirs(os.path.join(self.base, "chaves"))
        ch = os.path.join(self.base, "chaves", "conferidor.chave")
        open(ch, "w").write("forja_" + "c" * 43 + "\n")
        os.chmod(ch, 0o600)
        self.site, self.b2 = F.SiteArquivoFalso(), F.B2Falso()
        self.rclone, envf = F.rclone_falso(os.path.join(self.tmp, "bin"), F.dump_bom(senha=SENHA) if dump is None else dump)
        self.env = dict(os.environ, **envf, ARQUIVO_BASE=self.base, ARQ_SITE=self.site.url, ARQ_ENV="/nao/existe", ARQ_RITMO_S="0",
                        ARQ_MONTAGEM_ESCRITA=os.path.join(self.tmp, "mnt"), OBS_ARQUIVO_CONFERIR_B2="on")
        if sem_switch:
            del self.env["OBS_ARQUIVO_CONFERIR_B2"]
        self.site.attest_resposta = resposta_padrao()

    def por(self, filho, caminho, dados, senha=SENHA, **kw):
        return self.b2.por("site-arquivo/%s/%s.bin" % (filho, caminho), F.cifrar(senha, dados), **kw)

    def canarios(self, senha=SENHA):
        for f in c.FILHOS:
            self.por(f, "_canario/2026-11-27", b"canario " + f.encode() + b"\n", senha=senha)

    def rodar(self, modo="cron", **env):
        rc = cb.main(["--" + modo], env=dict(self.env, **env), rclone=self.rclone, b2_base=self.b2.url)
        return rc, json.loads(open(os.path.join(self.base, "log", "conferir-b2.jsonl")).read().splitlines()[-1])

    def informes(self):
        return [i for a in self.site.attests for i in a["itens"]]

    def parar(self):
        self.site.srv.parar()
        self.b2.srv.parar()


# ---------- 1. caminho feliz ----------
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz("id,views\n9,9\n"), ts=1)
fid = k.por("numerico", rel("2026-10"), F.gz(CSV1), ts=1764300000000)
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
rc, l = k.rodar()
inf = k.informes()
exige(rc == 0 and l["desfecho"] == "ok" and l["pedidos"] == 1 and l["informados"] == 1, "feliz: ok, pedidos 1, informados 1")
exige([i["arquivo_id"] for i in inf[:3]] == ["controle_negativo", "canario:numerico", "canario:texto"] and len(k.site.attests[0]["itens"]) == 3,
      "o controle negativo e os dois canários são o primeiro informe, sozinhos")
exige(inf[0]["resultado"] == "ausente", "controle negativo: ausente (listagem 200 vazia)")
u = inf[3]
exige(u["resultado"] == "presente" and u["file_id"] == fid and u["upload_timestamp"] == 1764300000000, "fileId e uploadTimestamp da versão atual, do B2")
exige(u["sha256"] == F.sha(F.gz(CSV1)) and u["linhas"] == 3 and u["soma"] == "15", "sha256 dos bytes DECIFRADOS, contagem e soma pelo leitor")
exige(all(a["execucao_id"] == EXEC and a["fonte"] == "b2" for a in k.site.attests) and u["tentativa"] == 1, "todo informe leva a execução e a tentativa")
exige("estado" not in l and l["estados"] == {"numerico": "com_pedidos", "texto": "com_pedidos"}, "com pedidos, a linha traz os estados do site e nenhum 'estado' de plano vazio")
exige(l["canario_ok"] == {"numerico": True, "texto": True} and l["rclone"] == k.rclone, "a linha traz o canario_ok do site e o rclone usado (Yannis I7)")
exige(k.site.recusados_zod == [] and k.site.batimentos[-1]["parado_no_teto"] is None and "total_bytes" in k.site.batimentos[-1],
      "todo corpo passa no Zod espelhado (C7.2 e C8 r2)")
exige(k.b2.srv.pedidos and all("/b2api/v4/" in p_[1] for p_ in k.b2.srv.pedidos), "só b2api/v4 (K5)")
exige(isinstance(l["quando"], str) and type(l["pedidos"]) is int and type(l["informados"]) is int, "a linha tem a forma que o bloco do pulso lê (M3a)")
exige(not os.listdir(os.path.join(k.base, "estado")) or all(n == "conferir-b2-bytes.json" for n in os.listdir(os.path.join(k.base, "estado"))),
      "nenhum arquivo decifrado fica na forja")
k.parar()

# ---------- 2. antes da primeira selagem ----------
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(primeira_selagem=None, estado={"numerico": "aguardando_primeira_selagem", "texto": "aguardando_primeira_selagem"})
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and l["pedidos"] == 0 and l["estado"] == "aguardando_primeira_selagem", "plano vazio antes da selagem: ok com o estado do site")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(primeira_selagem=None)
rc, l = k.rodar()
exige(l["pedidos"] == 0 and "estado" not in l, "primeira_selagem nula com estado com_pedidos: a forja NÃO deduz o estado (K4; o pulso fica vermelho)")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(estado={"numerico": "nada_devido", "texto": "nada_devido"})
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and l["estado"] == "nada_devido", "K4: nada_devido do site, com o canário de cada filho aceito nesta execução: ok")
k.parar()
k = Caso()
k.canarios()
k.site.attest_resposta = resposta_padrao(canario_ok={"texto": False})
k.site.planos[("b2", None)] = plano(estado={"numerico": "com_pedidos", "texto": "nada_devido"}, arquivos=[])
rc, l = k.rodar()
exige(l["desfecho"] == "controle_falhou", "K4: nada_devido sem o canário do mesmo filho aceito na execução: nunca ok")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(estado={"numerico": "nada_devido", "texto": "com_pedidos"}, arquivos=[item(U1, "2026-10")])
rc, l = k.rodar()
exige(l["desfecho"] == "plano_invalido" and k.site.attests == [], "nada_devido com arquivo do mesmo filho: plano_invalido")
k.parar()

# ---------- 3. o controle negativo ----------
k = Caso()
k.canarios()
k.por("numerico", "_controle/nao-existe-7f3a", b"x")
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
rc, l = k.rodar()
exige(l["desfecho"] == "controle_falhou" and len(k.site.attests) == 1, "controle negativo presente: controle_falhou, nenhum arquivo informado")
neg = k.informes()[0]
exige(neg["resultado"] == "presente" and "file_id" in neg and "sha256" not in neg and k.site.recusados_zod == [],
      "controle negativo presente vai com file_id e sem sha256 (C7.2 r2), e o Zod aceita")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
k.b2.fora = True
rc, l = k.rodar()
exige(l["desfecho"] == "sem_acesso" and all(i["resultado"] == "sem_acesso" for i in k.informes()), "B2 fora do ar: sem_acesso, ZERO ausente")
exige(all(i["arquivo_id"] in ("controle_negativo", "canario:numerico", "canario:texto") for i in k.informes()), "B2 fora: só os controles são informados")
k.parar()

# ---------- 4. o canário ----------
for rotulo, prep in (("adulterado (não decifra)", lambda k: k.canarios(senha="outra")),
                     ("ausente do B2", lambda k: None),
                     ("só num filho", lambda k: k.por("numerico", "_canario/2026-11-27", b"c"))):
    k = Caso()
    prep(k)
    k.por("numerico", rel("2026-10"), F.gz(CSV1))
    k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
    rc, l = k.rodar()
    exige(l["desfecho"] == "controle_falhou" and len(k.site.attests) == 1, "canário %s: controle_falhou, nada atesta nem retira" % rotulo)
    k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(canarios=[{"arquivo_id": "canario:numerico", "filho": "numerico", "caminho": "_canario/prova-m3a"},
                                             {"arquivo_id": "canario:texto", "filho": "texto", "caminho": "_canario/2026-11-27"}])
rc, l = k.rodar()
exige(l["desfecho"] == "plano_invalido" and k.site.attests == [], "canário prova-m3a no plano: recusado (só nome de data, M3a)")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(canarios=[{"arquivo_id": "canario:numerico", "filho": "numerico", "caminho": None},
                                             {"arquivo_id": "canario:texto", "filho": "texto", "caminho": "_canario/2026-11-27"}])
rc, l = k.rodar()
exige(l["desfecho"] == "controle_falhou" and {i["arquivo_id"]: i["resultado"] for i in k.informes()}["canario:numerico"] == "ausente"
      and l["contagens"].get("canario_desconhecido") == 1, "canário que o site ainda não conhece (caminho nulo): ausente, controle_falhou")
k.parar()

# ---------- 5. arquivos: ausente, escondido, não decifra, repetir ----------
k = Caso()
k.canarios()
k.por("numerico", rel("2026-09"), F.gz(CSV1))
k.b2.objetos["site-arquivo/numerico/%s.bin" % rel("2026-09")][0]["action"] = "hide"
k.por("numerico", rel("2026-07"), F.gz(CSV1), senha="errada")
k.por("numerico", rel("2026-06"), F.gz(CSV1))
k.site.attest_resposta = resposta_padrao(repetir=("u:" + U2,))
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10"), item("33333333-3333-4333-8333-333333333333", "2026-09"),
                                             item("44444444-4444-4444-8444-444444444444", "2026-07"), item(U2, "2026-06")])
rc, l = k.rodar()
res = {i["arquivo_id"]: i for i in k.informes()}
exige(res["u:" + U1]["resultado"] == "ausente" and res["u:33333333-3333-4333-8333-333333333333"]["resultado"] == "ausente", "não existe e escondido: ausente")
nd = res["u:44444444-4444-4444-8444-444444444444"]
exige(nd["resultado"] == "nao_decifra" and nd["file_id"].startswith("4_z") and "sha256" not in nd and l["contagens"]["nao_decifra"] == 1,
      "não decifra: nao_decifra com o fileId e sem sha256 (C7.2 r2, K4: o site retira já no primeiro informe)")
seg = [i for i in k.informes() if i["arquivo_id"] == "u:" + U2]
exige([i["tentativa"] for i in seg] == [1, 2] and seg[1]["sha256"] == seg[0]["sha256"], "repetir: baixa de novo e informa uma vez, com tentativa 2")
exige(l["desfecho"] == "ok" and l["informados"] == 4 and k.site.recusados_zod == [], "todos informados (nao_decifra é resultado próprio, não derruba o desfecho)")
k.parar()
k = Caso()
k.canarios()
fid_up = k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.por("numerico", rel("2026-10"), b"", action="start")
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
rc, l = k.rodar()
exige(l["desfecho"] == "ok" and k.informes()[3]["file_id"] == fid_up, "versão start mais nova (envio grande em curso): presente pela upload (Yannis I3)")
k.parar()
k = Caso()
k.canarios()
for n_, m in enumerate(("2026-10", "2026-09", "2026-08")):
    k.por("numerico", rel(m), F.gz(CSV1))
k.b2.cota_downloads = 3                     # os dois canários e um arquivo; depois, 403 download_cap_exceeded
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10"), item(U2, "2026-09"), item("33333333-3333-4333-8333-333333333333", "2026-08")])
rc, l = k.rodar()
exige(l["desfecho"] == "sem_acesso" and l["contagens"].get("arquivo_sem_acesso") == 2,
      "403 download_cap_exceeded a partir do 2º arquivo: desfecho sem_acesso, nunca ok (Yannis I5, Phil I1)")
k.parar()

# ---------- 6. remotos, chave da cifra, variável ----------
k = Caso(dump={**F.dump_bom(), "arq": {**F.dump_bom()["arq"], "remote": "nas:/mnt/arquivo/leitura"}})
k.site.planos[("b2", None)] = plano()
rc, l = k.rodar()
exige(l["desfecho"] == "remoto_nao_b2" and [p for p in k.site.srv.pedidos if not p[1].endswith("/heartbeat")] == [], "apontado para a montagem do NAS: recusa rodar e não atesta nada (item 132)")
k.parar()
k = Caso(dump={"b2arq": F.dump_bom()["b2arq"]})
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
rc, l = k.rodar()
exige(l["desfecho"] == "chave_ausente" and {i["resultado"] for i in k.informes()} == {"chave_ausente"} and len(k.informes()) == 4,
      "sem a configuração da cifra: informa chave_ausente de tudo (não retira)")
k.parar()
k = Caso(sem_switch=True)
k.site.planos[("b2", None)] = plano()
rc, l = k.rodar()
exige(l["desfecho"] == "desligado" and k.site.srv.pedidos == [] and k.b2.srv.pedidos == [], "OBS_ARQUIVO_CONFERIR_B2 apagada: não roda (item 132)")
k.parar()
k = Caso()
rc, l = k.rodar(OBS_ARQUIVO_CONFERIR_B2="sim")
exige(l["desfecho"] == "desligado", "só 'on' liga")
k.parar()

# ---------- 7. teto de bytes (P59) ----------
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
TETO = sum(len(v[0]["dados"]) for n, v in k.b2.objetos.items() if "_canario/" in n) + 10
k.site.planos[("b2", None)] = plano(teto_bytes_dia=TETO, arquivos=[item(U1, "2026-10")])
k.site.teto_cor = "ambar"
rc, l = k.rodar()
cont = json.load(open(os.path.join(k.base, "estado", "conferir-b2-bytes.json")))
exige(l["teto_cor"] == "ambar", "r2.2 (M6): a cor do teto vem do batimento e vai para a linha (primeiro dia: âmbar, contado pelo site)")
exige(l["desfecho"] == "teto_bytes" and l["informados"] == 0 and cont["bytes_dia"] <= TETO and l["teto"] == "dia",
      "teto do dia: para antes de passar, não informa o que não baixou")
exige(k.site.batimentos[-1]["parado_no_teto"] == "dia", "o batimento diz parado_no_teto: dia (C8 r2, âmbar na página)")
k.site.teto_cor = "vermelho"
rc, l = k.rodar()
exige(l["teto_cor"] == "vermelho", "r2.2 (M6): o site diz vermelho (segundo dia seguido) e a linha copia, sem contar nada")
exige(l["desfecho"] == "teto_bytes" and json.load(open(os.path.join(k.base, "estado", "conferir-b2-bytes.json")))["bytes_dia"] <= TETO,
      "o contador soma entre execuções do mesmo dia (a segunda já não baixa os canários: teto_bytes, nunca controle_falhou: m3)")
k.site.teto_cor = "roxo"
rc, l = k.rodar()
exige(l["desfecho"] == "teto_bytes" and l["teto_cor"] is None, "r2.2: cor fora da lista vira nula (o pulso lê teto_bytes sem cor como vermelho)")
k.site.falhar["heartbeat"] = (502, "x")
rc, l = k.rodar()
exige(l["desfecho"] == "teto_bytes" and l["teto_cor"] is None, "r2.2: batimento que falha deixa a cor nula, nunca âmbar")
del k.site.falhar["heartbeat"]
c.trocar_atomico(os.path.join(k.base, "estado", "conferir-b2-bytes.json"), json.dumps({"dia": "2000-01-01", "bytes_dia": 149, "mes": "2000-01", "bytes_mes": 149}).encode())
x = cb.Contador(os.path.join(k.base, "estado", "conferir-b2-bytes.json"), 150)
exige(x.d["bytes_dia"] == 0 and x.d["bytes_mes"] == 0, "o contador vira no dia e no mês da forja")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(teto_bytes_mes=100)
hoje = datetime.now().astimezone().strftime("%Y-%m-%d")
os.makedirs(os.path.join(k.base, "estado"), exist_ok=True)
c.trocar_atomico(os.path.join(k.base, "estado", "conferir-b2-bytes.json"), json.dumps({"dia": hoje, "bytes_dia": 0, "mes": hoje[:7], "bytes_mes": 100}).encode())
rc, l = k.rodar()
exige(l["desfecho"] == "teto_bytes" and l["teto"] == "mes" and l["contagens"].get("bytes", 0) == 0 and k.site.batimentos[-1]["parado_no_teto"] == "mes",
      "P59: mês em metade da franquia, dia zerado: não baixa nada, teto: mes (Pedido 3)")
k.parar()
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.por("numerico", rel("2026-09"), F.gz(CSV1))
CAN = sum(len(v[0]["dados"]) for n, v in k.b2.objetos.items() if "_canario/" in n)
UM = len(k.b2.objetos["site-arquivo/numerico/%s.bin" % rel("2026-10")][0]["dados"])
k.site.planos[("b2", None)] = plano(teto_bytes_dia=CAN + UM + 5, arquivos=[item(U1, "2026-10"), item(U2, "2026-09")])
rc, l = k.rodar()
exige(l["desfecho"] == "teto_bytes" and l["informados"] == 1 and [i["resultado"] for i in k.informes()][3:] == ["presente"],
      "teto no meio do lote: o que já baixou é decifrado e informado (M3 do Phil)")
k.parar()

# ---------- 8. orçamento, completo e prova ----------
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
orig_ctl = cb.Conferencia.controle


def ctl_e_esgota(self, p_):
    r_ = orig_ctl(self, p_)
    self.t0 -= 10 ** 6
    return r_


cb.Conferencia.controle = ctl_e_esgota
rc, l = k.rodar()
cb.Conferencia.controle = orig_ctl
exige(l["parcial"] is True and l["desfecho"] == "incompleto" and len(k.site.attests) == 1, "orçamento esgotado depois do controle: para, nunca controle_falhou")
k.parar()
k = Caso()
k.canarios()
meses = ("2026-10", "2026-09", "2026-08", "2026-07", "2026-06")
for m in meses:
    k.por("numerico", rel(m), F.gz(CSV1))
k.b2.atraso = 0.3
k.site.planos[("b2", None)] = plano(arquivos=[item("%08d-1111-4111-8111-111111111111" % n_, m) for n_, m in enumerate(meses)])
rc, l = k.rodar(ARQ_ORCAMENTO_S="1")
exige(l["parcial"] is True and 1 <= l["informados"] < 5 and l["informados"] == l["contagens"].get("arquivo_presente"),
      "orçamento olhado antes de CADA download: para no meio do lote e informa o que baixou (Yannis I6)")
k.parar()
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
orig_arq = cb.Conferencia.arquivos
cb.Conferencia.arquivos = lambda self, lista: (_ for _ in ()).throw(c.Cortado())
rc, l = k.rodar()
cb.Conferencia.arquivos = orig_arq
exige(l["desfecho"] == "timeout" and l["parcial"] is True and "contagens" in l, "SIGTERM: linha timeout com parcial e contagens (Yannis I6)")
k.parar()
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
k.site.attest_resposta = resposta_padrao()
_r = k.site.attest_resposta


def uma_e_cai(corpo):
    d_ = _r(corpo)
    k.site.falhar["attest"] = (502, "x")
    return d_


k.site.attest_resposta = uma_e_cai
rc, l = k.rodar()
exige(l["desfecho"] == "site_fora" and l["parcial"] is True and "contagens" in l, "502 no attest dos arquivos: site_fora com contagens, nunca bug (Yannis I1)")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano()
velho = os.path.join(k.base, "estado", "conferir-b2-velho", "claro")
os.makedirs(velho)
open(os.path.join(velho, "x"), "w").write("comentário decifrado")
rc, l = k.rodar()
exige(not os.path.exists(os.path.dirname(velho)) and l.get("tmp_limpo") == 1, "sobra decifrada de uma execução morta sai no começo da seguinte (Yannis I11)")
k.parar()
k = Caso()
k.site.planos[("b2", None)] = plano()
rc, l = k.rodar(ARQ_ORCAMENTO_S="abc")
exige(l["desfecho"] == "bug" and l["erro"] == "config ARQ_ORCAMENTO_S" and k.site.srv.pedidos == [], "ARQ_ORCAMENTO_S ilegível: bug com o nome, nenhum pedido (m4)")
k.parar()
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.por("numerico", rel("2026-09"), F.gz(CSV1))
k.site.planos[("b2", None)] = plano(modo="completo", cursor_seguinte="p2", arquivos=[item(U1, "2026-10")])
k.site.planos[("b2", "p2")] = {"execucao_id": EXEC, "modo": "completo", "cursor_seguinte": None, "arquivos": [item(U2, "2026-09")]}
rc, l = k.rodar("completo")
exige(l["modo"] == "completo" and l["pedidos"] == 2 and l["informados"] == 2 and k.site.srv.pedidos[0][2] == {"fonte": "b2", "completo": "1"},
      "--completo: completo=1, segue o cursor na mesma execução")
exige(l["retomado_de"] is None and l["cobertura"] == {"paginas_aceitas": 0, "paginas_total": 1}, "--completo do zero: retomado_de nulo, cobertura na linha")
k.parar()
# r2.2 (I3 do Phil): a retomada entre execuções é do SITE. A forja pede sem cursor; o plano já vem retomado.
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.por("numerico", rel("2026-09"), F.gz(CSV1))
RET = EXEC + "|u:" + U1
k.site.planos[("b2", None)] = plano(modo="completo", cursor_seguinte="p2", retomado_de=RET,
                                    cobertura={"paginas_aceitas": 3, "paginas_total": 5}, arquivos=[item(U1, "2026-10")])
k.site.planos[("b2", "p2")] = {"execucao_id": EXEC, "modo": "completo", "cursor_seguinte": None, "arquivos": [item(U2, "2026-09")],
                               "cobertura": {"paginas_aceitas": 4, "paginas_total": 5}}
rc, l = k.rodar("completo")
exige(rc == 0 and k.site.srv.pedidos[0][2] == {"fonte": "b2", "completo": "1"},
      "r2.2: a execução seguinte do --completo pede sem cursor (o ponto de retomada mora no site)")
exige(l["retomado_de"] == RET and l["cobertura"] == {"paginas_aceitas": 4, "paginas_total": 5} and l["informados"] == 2,
      "r2.2: a linha guarda de onde retomou e a última cobertura (o dono lê no tail -1)")
k.parar()
for rotulo, kw in (("completo sem cobertura", dict(modo="completo", cobertura=None)),
                   ("aceitas acima do total", dict(modo="completo", cobertura={"paginas_aceitas": 6, "paginas_total": 5})),
                   ("total zero", dict(modo="completo", cobertura={"paginas_aceitas": 0, "paginas_total": 0})),
                   ("normal com cobertura", dict(cobertura={"paginas_aceitas": 0, "paginas_total": 1})),
                   ("normal retomado", dict(retomado_de=RET)),
                   ("sem o campo retomado_de", dict(retomado_de="APAGAR"))):
    k = Caso()
    k.canarios()
    pl = plano(**kw)
    if pl["retomado_de"] == "APAGAR":
        del pl["retomado_de"]
    k.site.planos[("b2", None)] = pl
    rc, l = k.rodar("completo" if pl["modo"] == "completo" else "cron")
    exige(l["desfecho"] == "plano_invalido" and k.site.attests == [], "r2.2: %s é plano_invalido, nada informado" % rotulo)
    k.parar()
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.por("numerico", rel("2026-09"), F.gz(CSV1))
k.site.planos[("b2", None)] = plano(modo="completo", cursor_seguinte="p2", arquivos=[item(U1, "2026-10")])
k.site.planos[("b2", "p2")] = {"execucao_id": EXEC, "modo": "completo", "cursor_seguinte": None, "arquivos": [item(U2, "2026-09")]}
_base = resposta_padrao()
vencer = {"u:" + U2: 1}


def vence_uma_vez(corpo):
    d_ = _base(corpo)
    for i in d_["itens"]:
        if vencer.get(i["arquivo_id"]):
            vencer[i["arquivo_id"]] -= 1
            i.update(resposta="recusado", motivo="execucao_vencida")
    return d_


k.site.attest_resposta = vence_uma_vez
rc, l = k.rodar("completo")
pedidos_plano = [p_[2].get("cursor") for p_ in k.site.srv.pedidos if p_[1].endswith("/plan")]
baixou_u1 = sum(1 for i in k.informes() if i["arquivo_id"] == "u:" + U1)
exige(l["desfecho"] == "ok" and l["informados"] == 2 and pedidos_plano == [None, "p2", "p2"] and baixou_u1 == 1,
      "X1 da r2.1: execucao_vencida numa página: pede de novo no cursor da última página aceita e retoma, sem refazer a primeira")
k.parar()
k = Caso()
k.canarios()
k.por("numerico", rel("2026-10"), F.gz(CSV1))
k.por("numerico", rel("2026-09"), F.gz(CSV1))
k.site.planos[("b2", None)] = plano(modo="completo", cursor_seguinte="p2", arquivos=[item(U1, "2026-10")])
k.site.planos[("b2", "p2")] = {"execucao_id": EXEC, "modo": "completo", "cursor_seguinte": None, "arquivos": [item(U2, "2026-09")]}
NOVA = "eeeeeeee-0000-4000-8000-000000000002"
_base2 = resposta_padrao()
vencer = {"u:" + U2: 1}


def vence_e_abre_nova(corpo):
    d_ = _base2(corpo)
    for i in d_["itens"]:
        if vencer.get(i["arquivo_id"]):
            vencer[i["arquivo_id"]] -= 1
            i.update(resposta="recusado", motivo="execucao_vencida")
            k.site.planos[("b2", "p2")] = plano(execucao_id=NOVA, modo="completo", arquivos=[item(U2, "2026-09")])
    return d_


k.site.attest_resposta = vence_e_abre_nova
rc, l = k.rodar("completo")
ids = [(a["execucao_id"], [i["arquivo_id"] for i in a["itens"]]) for a in k.site.attests]
exige(l["desfecho"] == "ok" and l["execucao_id"] == NOVA and ids[-2] == (NOVA, ["controle_negativo", "canario:numerico", "canario:texto"])
      and ids[-1] == (NOVA, ["u:" + U2]), "X1: o site abriu execução nova no cursor: a forja refaz o controle e só então informa o arquivo")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(modo="completo", cursor_seguinte="p2", arquivos=[])
k.site.planos[("b2", "p2")] = {"execucao_id": "ffffffff-0000-4000-8000-000000000009", "modo": "completo", "cursor_seguinte": None, "arquivos": []}
rc, l = k.rodar("completo")
exige(l["desfecho"] == "plano_invalido", "página com outra execução: plano_invalido")
k.parar()
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano(arquivos=[item(U1, "2026-10")])
rc, l = k.rodar("prova")
exige(l["modo"] == "prova" and l["desfecho"] == "ok" and k.site.attests == [] and k.site.batimentos == [], "prova: lê o plano e o B2, não informa nada")
k.parar()

# ---------- 9. variáveis com padrão (item 79) ----------
cf = c.config("conferir-b2", c.ambiente("conferir-b2", {"ARQ_ENV": "/nao/existe"}))
exige(cf["chave"] == "/opt/arquivo/chaves/conferidor.chave" and cf["log"] == "/opt/arquivo/log/conferir-b2.jsonl", "padrões do conferir-b2")
k = Caso()
k.canarios()
k.site.planos[("b2", None)] = plano()
env = dict(k.env)
env.pop("ARQ_B2_SUFIXO", None)
env.pop("ARQ_B2_BANDA_KIBPS", None)
rc = cb.main(["--cron"], env=env, rclone=k.rclone, b2_base=k.b2.url)
exige(rc == 0, "ARQ_B2_SUFIXO e ARQ_B2_BANDA_KIBPS apagadas: .bin e 1024 KiB/s (o caminho feliz roda com os padrões)")
k.parar()

exige(c.carregar_env(os.path.join(AQUI, "conferir-b2.env.modelo")) == {"OBS_ARQUIVO_CONFERIR_B2": "off"}, "o modelo do .env nasce desligado e sem segredo")
exige(c.carregar_env(os.path.join(AQUI, "copiador.env.modelo")) == {}, "o modelo do copiador não tem variável ligada nem segredo")

print("\nconferir-b2: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_conferir_b2.py`
Expected: `FileNotFoundError` em `conferir-b2/conferir.py`, saída 1. (Os modelos de `.env` da Tarefa 6 também faltam: a asserção do modelo do B2 só passa depois dela; o `teste_tudo.sh` da Tarefa 6 roda este teste de novo.)

- [ ] **Step 3: Escrever o `conferir-b2`**

`arquivo/conferir-b2/conferir.py`:

```python
"""M3b (forja): o conferir-b2 (spec 02 §10.9; contrato C2, C7.2 e C8, r2; D-F2).

Uso, na forja (cron: 11:07, D-F9):
  /usr/bin/python3 -B /opt/arquivo/conferir-b2/conferir.py --cron       a execução do cron (a única que o pulso conta)
  /usr/bin/python3 -B /opt/arquivo/conferir-b2/conferir.py --prova      lê o plano e o B2 (controle e canários); não informa nada
  /usr/bin/python3 -B /opt/arquivo/conferir-b2/conferir.py --completo   pede ao site todos os arquivos (02 §10.10; pode-desligar)

Baixa do B2 PELO fileId que listou (os bytes conferidos são os do fileId informado), decifra pelo rclone sobre uma
pasta temporária, calcula o sha256 e abre o CSV com o leitor de produção. Primeiro o controle negativo e os dois
canários; sem os três certos, nada mais é informado (controle_falhou). 'Ausente' só de uma listagem 200 sem versão
viva. O estado de cada filho (aguardando_primeira_selagem, nada_devido, com_pedidos) vem do SITE (C2 r2, K4):
a forja nunca o deduz de 'zero pedidos' nem de primeira_selagem.
--completo que não termina numa execução (r2.2, I3 do Phil): quem guarda o ponto é o SITE; a execução seguinte recebe
o plano já retomado (retomado_de, cobertura) e a forja só segue as páginas. A cor do teto de bytes (âmbar no primeiro
dia, vermelho no segundo seguido) também é do site: volta no batimento e vai para a linha como teto_cor."""
import argparse, glob, json, os, re, shutil, sys, tempfile, time, traceback
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import b2 as B  # noqa: E402
import comum as c  # noqa: E402
from cliente_site import ArquivoDesligado, ChaveRecusada, ErroDoSite, Recusa, Site, SiteFora  # noqa: E402

PROGRAMA = "conferir-b2"
LOTE = 200                                      # C7.2 r2: 1..200 itens por chamada
ESTADOS = ("aguardando_primeira_selagem", "nada_devido", "com_pedidos")
CORES_TETO = ("verde", "ambar", "vermelho")    # r2.2 (M6 do Phil): a resposta do batimento do conferir_b2
RE_NOME_FABRICADO = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]*(/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$")


class Contador:
    """P59: bytes baixados por dia e por mês, somados em todas as execuções; viram à meia-noite e no dia 1 da forja.
    Os dois tetos vêm do plano do site (C2 r2: teto_bytes_dia e teto_bytes_mes); o restante é o menor dos dois."""
    def __init__(self, caminho, teto_dia, teto_mes=None, agora=None):
        self.caminho, self.teto_dia, self.teto_mes = caminho, teto_dia, teto_mes
        hoje = (agora or datetime.now().astimezone()).strftime("%Y-%m-%d")
        try:
            d = json.load(open(caminho))
        except (OSError, ValueError):
            d = {}
        self.d = {"dia": hoje, "bytes_dia": d.get("bytes_dia", 0) if d.get("dia") == hoje else 0,
                  "mes": hoje[:7], "bytes_mes": d.get("bytes_mes", 0) if d.get("mes") == hoje[:7] else 0}

    def _resta(self):
        dia = max(self.teto_dia - self.d["bytes_dia"], 0)
        mes = max(self.teto_mes - self.d["bytes_mes"], 0) if self.teto_mes is not None else dia
        return dia, mes

    def restante(self):
        return min(self._resta())

    def qual_teto(self):
        """'mes' quando é o do mês que segura, senão 'dia' (vai no batimento: parado_no_teto, C8 r2)."""
        dia, mes = self._resta()
        return "mes" if mes < dia else "dia"

    def somar(self, n):
        self.d["bytes_dia"] += n
        self.d["bytes_mes"] += n
        c.trocar_atomico(self.caminho, json.dumps(self.d).encode(), 0o600)


class TetoAtingido(Exception):
    pass


class Vencida(Exception):
    """X1 da r2.1: o site respondeu execucao_vencida (2 h por página, renovada a cada GET de página)."""


def cobertura_valida(modo, retomado_de, cob):
    """C2 r2.2: no modo normal os dois vêm nulos; no completo, retomado_de é o cursor (texto até 200) ou nulo, e
    cobertura traz páginas aceitas e total (total >= 1: a página vazia conta), com aceitas <= total."""
    if not (retomado_de is None or (isinstance(retomado_de, str) and 0 < len(retomado_de) <= 200)):
        return False
    if modo == "normal":
        return retomado_de is None and cob is None
    return (isinstance(cob, dict) and set(cob) == {"paginas_aceitas", "paginas_total"}
            and all(type(cob[k]) is int for k in cob) and 0 <= cob["paginas_aceitas"] <= cob["paginas_total"]
            and cob["paginas_total"] >= 1)


def validar_plano(d):
    if not (isinstance(d, dict) and isinstance(d.get("execucao_id"), str) and c.RE_UUID.match(d["execucao_id"])
            and d.get("modo") in ("normal", "completo") and isinstance(d.get("vermelhos"), list)
            and type(d.get("teto_bytes_dia")) is int and d["teto_bytes_dia"] >= 0
            and type(d.get("teto_bytes_mes")) is int and d["teto_bytes_mes"] >= 0
            and isinstance(d.get("estado"), dict) and set(d["estado"]) == set(c.FILHOS)
            and all(v in ESTADOS for v in d["estado"].values())
            and isinstance(d.get("arquivos"), list) and len(d["arquivos"]) <= 500 and d.get("prefixos_ausentes") == []):
        raise c.CaminhoInvalido("plano do B2 fora do contrato C2")
    if not ("retomado_de" in d and "cobertura" in d and cobertura_valida(d["modo"], d["retomado_de"], d["cobertura"])):
        raise c.CaminhoInvalido("retomado_de ou cobertura fora do contrato C2 r2.2")
    neg = d.get("controle_negativo") or {}
    if (neg.get("arquivo_id") != "controle_negativo" or neg.get("filho") not in c.FILHOS
            or not RE_NOME_FABRICADO.match(str(neg.get("caminho", ""))) or ".." in str(neg.get("caminho"))):
        raise c.CaminhoInvalido("controle negativo fora do contrato")
    can = d.get("canarios")
    if not isinstance(can, list) or len(can) != 2 or sorted(x.get("filho") for x in can if isinstance(x, dict)) != sorted(c.FILHOS):
        raise c.CaminhoInvalido("o plano tem de trazer um canário por filho")
    for x in can:
        # Só o nome exato de data (M3a: prova-m3a nunca vale). Caminho nulo = o site ainda não conhece canário com
        # 6 horas ou mais daquele filho (C2 r2): vale como ausente, e o controle daquele filho não passa.
        if x.get("arquivo_id") != "canario:" + x["filho"] or not (
                x.get("caminho") is None or re.fullmatch(r"_canario/\d{4}-\d{2}-\d{2}", str(x.get("caminho")))):
            raise c.CaminhoInvalido("canário fora do contrato")
    for f, e in d["estado"].items():          # o site diz 'nada devido' para um filho e manda arquivo dele: contradição
        if e != "com_pedidos" and any(isinstance(a, dict) and a.get("filho") == f for a in d["arquivos"]):
            raise c.CaminhoInvalido("estado %s do filho %s com arquivo pedido" % (e, f))
    return d


class Conferencia:
    def __init__(self, cf, site, conf, cli, rclone, sufixo, contador, env):
        self.cf, self.site, self.conf, self.cli, self.rclone, self.sufixo = cf, site, conf, cli, rclone, sufixo
        self.contador, self.env = contador, env
        self.t0 = time.monotonic()
        self.tmp = tempfile.mkdtemp(prefix="conferir-b2-", dir=cf["estado"])
        self.n = Counter()
        self.invalido = self.parcial = self.teto = False
        self.execucao_id = None
        self.pedidos = self.informados = 0
        self.canario_ok = {}
        self.feitos = set()             # arquivo_id aceitos nesta execução: a retomada (X1) não os baixa de novo
        self.renovacoes = 0

    def acabou_o_tempo(self):
        if time.monotonic() - self.t0 > self.cf["orcamento_s"]:
            self.parcial = True
        return self.parcial

    def resta_s(self):
        return self.cf["orcamento_s"] - (time.monotonic() - self.t0)

    def nome(self, filho, rel):
        return B.nome_b2(self.conf, filho, rel, self.sufixo)

    def _baixar(self, file_id, destino):
        """Uma segunda tentativa por arquivo na mesma execução (Phil I1): erro de transporte isolado não vira alarme."""
        for tentativa in (1, 2):
            try:
                return self.cli.baixar(file_id, destino, self.contador.restante())
            except B.ErroB2 as e:
                if tentativa == 2 or e.status in (403, 404):
                    raise
                self.n["download_de_novo"] += 1

    def baixar_e_ler(self, lista):
        """lista de (arquivo_id, filho, rel, coluna). Lista no B2, baixa pelo fileId, decifra em lote e lê.
        Devolve {arquivo_id: informe} do que conseguiu. No teto de bytes ou no fim do orçamento PARA de baixar,
        decifra e informa o que já veio (M3 do Phil; importante 6 do Yannis), e marca self.teto / self.parcial."""
        informes, baixados = {}, []
        for aid, filho, rel, coluna in lista:
            if self.acabou_o_tempo():
                break
            try:
                atual = self.cli.atual(self.nome(filho, rel))
            except B.ErroB2:
                informes[aid] = {"arquivo_id": aid, "resultado": "sem_acesso"}
                continue
            if atual is None:
                informes[aid] = {"arquivo_id": aid, "resultado": "ausente"}
                continue
            if atual.get("contentLength", 0) > self.contador.restante():
                self.teto = True
                break
            destino = os.path.join(self.tmp, "cif", filho, rel + self.sufixo)
            try:
                n, nome = self._baixar(atual["fileId"], destino)
            except B.TetoDeBytes:
                self.teto = True
                break
            except B.ErroB2:
                informes[aid] = {"arquivo_id": aid, "resultado": "sem_acesso"}
                continue
            self.contador.somar(n)
            self.n["bytes"] += n
            if nome != self.nome(filho, rel):       # m7/M2b: o x-bz-file-name tem de ser o do arquivo pedido
                self.n["nome_errado"] += 1
                informes[aid] = {"arquivo_id": aid, "resultado": "sem_acesso"}
                continue
            baixados.append((aid, filho, rel, coluna, atual))
        por_filho = {}
        for b in baixados:
            por_filho.setdefault(b[1], []).append(b)
        for filho, grupo in por_filho.items():
            saida = os.path.join(self.tmp, "claro", filho)
            ok = B.decifrar(self.rclone, self.conf, os.path.join(self.tmp, "cif", filho), [g[2] for g in grupo], saida, self.sufixo,
                            self.env, timeout=int(self.resta_s()))
            for aid, _, rel, coluna, atual in grupo:
                if not ok.get(rel):
                    # C7.2 r2 (K4): resultado próprio; o site o trata como divergente já no primeiro informe e retira.
                    informes[aid] = {"arquivo_id": aid, "resultado": "nao_decifra", "file_id": atual["fileId"],
                                     "upload_timestamp": atual["uploadTimestamp"]}
                    self.n["nao_decifra"] += 1
                    continue
                v = c.ler_arquivo(os.path.join(saida, rel), coluna, rel.endswith(".csv.gz"))
                informes[aid] = {"arquivo_id": aid, "resultado": "presente", "sha256": v["sha256"], "bytes": v["bytes"],
                                 "linhas": v["linhas"], "soma": v["soma"], "file_id": atual["fileId"],
                                 "upload_timestamp": atual["uploadTimestamp"]}
        shutil.rmtree(os.path.join(self.tmp, "cif"), ignore_errors=True)
        shutil.rmtree(os.path.join(self.tmp, "claro"), ignore_errors=True)
        return informes

    def informar(self, itens, tentativa=1):
        corpo = {"fonte": "b2", "execucao_id": self.execucao_id, "itens": [dict(i, tentativa=tentativa) for i in itens]}
        try:
            d = self.site.dados("POST", "attest", corpo)
        except Recusa as e:
            self.n["informe_recusado_" + (e.code or str(e.status))] += len(itens)
            return {}
        for r in d.get("itens", []):
            self.n["resposta_" + str(r.get("resposta"))] += 1
        return d

    def controle(self, plano):
        """Controle negativo + os dois canários, no primeiro informe (02 §10.9). Devolve (local, informes):
        local é True só com o negativo ausente e os dois canários presentes. Teto nos canários: TetoAtingido (m3)."""
        neg = plano["controle_negativo"]
        try:
            v = self.cli.atual(self.nome(neg["filho"], neg["caminho"]))
            r_neg = {"arquivo_id": "controle_negativo", "resultado": "ausente"} if v is None else \
                {"arquivo_id": "controle_negativo", "resultado": "presente", "file_id": v["fileId"],
                 "upload_timestamp": v["uploadTimestamp"]}         # C7.2 r2: sem sha256 (não baixa o que não devia existir)
        except B.ErroB2:
            r_neg = {"arquivo_id": "controle_negativo", "resultado": "sem_acesso"}
        conhecidos = [x for x in plano["canarios"] if x["caminho"] is not None]
        canarios = self.baixar_e_ler([(x["arquivo_id"], x["filho"], x["caminho"], None) for x in conhecidos])
        if self.teto:
            raise TetoAtingido()
        for x in plano["canarios"]:
            if x["caminho"] is None:
                canarios[x["arquivo_id"]] = {"arquivo_id": x["arquivo_id"], "resultado": "ausente"}
                self.n["canario_desconhecido"] += 1
            elif x["arquivo_id"] not in canarios:           # orçamento acabou no meio dos canários
                canarios[x["arquivo_id"]] = {"arquivo_id": x["arquivo_id"], "resultado": "sem_acesso"}
        self.n["controle_negativo_" + r_neg["resultado"]] += 1
        for r in canarios.values():
            self.n["canario_" + r["resultado"]] += 1
        local = r_neg["resultado"] == "ausente" and all(r["resultado"] == "presente" for r in canarios.values())
        return local, [r_neg] + [canarios[x["arquivo_id"]] for x in plano["canarios"]]

    def arquivos(self, lista):
        """Por (filho, classe, mês), em lotes de até 200; 'repetir' baixa de novo na mesma execução, uma vez (item 132)."""
        grupos = {}
        for it in lista:
            try:
                filho, rel = c.caminho_do_item(it)
            except c.CaminhoInvalido:
                self.invalido = True
                continue
            if it["arquivo_id"] not in self.feitos:
                grupos.setdefault((filho, it["classe"], it["mes"]), []).append((it["arquivo_id"], filho, rel, it.get("coluna_controle")))
        for chave in sorted(grupos):
            grupo = grupos[chave]
            for i in range(0, len(grupo), LOTE):
                if self.acabou_o_tempo() or self.teto:
                    return
                lote = grupo[i:i + LOTE]
                informes = self.baixar_e_ler(lote)
                enviados = [informes[a] for a, _, _, _ in lote if a in informes]
                if not enviados:
                    continue
                for x in enviados:
                    self.n["arquivo_" + x["resultado"]] += 1
                d = self.informar(enviados)
                repetir, vencida = [], False
                for r in d.get("itens", []):
                    if r.get("resposta") in ("aceito", "repetir"):
                        self.informados += 1
                        self.feitos.add(r.get("arquivo_id"))
                    elif r.get("motivo") == "execucao_vencida":
                        vencida = True
                        self.n["resposta_recusado"] -= 1        # não é recusa de forma: a retomada informa de novo
                    if r.get("resposta") == "repetir":
                        repetir.append(r.get("arquivo_id"))
                if repetir:
                    de_novo = self.baixar_e_ler([x for x in lote if x[0] in repetir])
                    if de_novo:
                        self.informar([de_novo[a] for a in repetir if a in de_novo], tentativa=2)
                    self.n["repetidos"] += len(repetir)
                if vencida:
                    raise Vencida()


def desfecho_de(cx, linha):
    """C9 r2. ok só com o plano cumprido: nenhum sem_acesso, nenhum informe recusado, e ao menos um presente quando
    o plano pediu algum (M3a; Phil I1, Yannis I5). nao_decifra é resultado próprio (o site retira e acende o vermelho)."""
    if cx.invalido:
        return "plano_invalido"
    if cx.n["arquivo_sem_acesso"]:
        return "sem_acesso"
    if any(k.startswith("informe_recusado_") for k in cx.n) or cx.n["resposta_recusado"]:
        return "informe_recusado"
    if cx.teto:
        return "teto_bytes"                     # P59: parado no teto (âmbar na página); continua amanhã
    if linha["informados"] < linha["pedidos"] or (linha["pedidos"] > 0 and not cx.n["arquivo_presente"]):
        return "incompleto"
    return "ok"


def executar(cf, site, modo, rclone, env, b2_base="https://api.backblazeb2.com", estado_saida=None):
    if env.get("OBS_ARQUIVO_CONFERIR_B2") != "on":
        return {"modo": modo, "desfecho": "desligado"}       # 02 §10.9: ausente, não roda; o site vê o silêncio
    consulta = {"fonte": "b2", **({"completo": "1"} if modo == "completo" else {})}
    try:
        conf = B.remotos(rclone, env)
        sem_chave = None
    except B.ConfigB2 as e:
        if e.motivo != "chave_ausente":
            return {"modo": modo, "desfecho": e.motivo}      # remoto_nao_b2: recusa rodar (02 §10.9)
        conf, sem_chave = None, e.motivo
    try:
        plano = validar_plano(site.dados("GET", "plan", consulta=consulta))
    except ArquivoDesligado:
        return {"modo": modo, "desfecho": "arquivo_desligado"}
    except ChaveRecusada:
        return {"modo": modo, "desfecho": "chave"}
    except c.CaminhoInvalido:
        return {"modo": modo, "desfecho": "plano_invalido"}
    except ErroDoSite as e:
        return {"modo": modo, "desfecho": "site_fora", "erro": str(e)[:200]}
    linha = {"modo": modo, "execucao_id": plano["execucao_id"], "pedidos": len(plano["arquivos"]), "informados": 0,
             "estados": dict(plano["estado"]), "retomado_de": plano["retomado_de"], "cobertura": plano["cobertura"]}
    todos = [{"arquivo_id": "controle_negativo"}] + [{"arquivo_id": x["arquivo_id"]} for x in plano["canarios"]] + \
        [{"arquivo_id": x.get("arquivo_id")} for x in plano["arquivos"] if isinstance(x, dict)]
    if sem_chave:
        if modo != "prova":
            for i in range(0, len(todos), LOTE):
                site.dados("POST", "attest", {"fonte": "b2", "execucao_id": plano["execucao_id"],
                                              "itens": [dict(t, resultado="chave_ausente", tentativa=1) for t in todos[i:i + LOTE]]})
        return dict(linha, desfecho="chave_ausente")
    sufixo = env.get("ARQ_B2_SUFIXO") or ".bin"
    try:
        banda = int(env.get("ARQ_B2_BANDA_KIBPS") or 1024) * 1024
    except ValueError:
        banda = 1024 * 1024
    contador = Contador(os.path.join(cf["estado"], "conferir-b2-bytes.json"), plano["teto_bytes_dia"], plano["teto_bytes_mes"])
    try:
        cli = B.B2(conf["conta"], conf["chave"], conf["bucket"], base=b2_base, banda_bps=banda).autorizar()
    except B.ErroB2:
        if modo != "prova":
            site.dados("POST", "attest", {"fonte": "b2", "execucao_id": plano["execucao_id"],
                                          "itens": [dict(t, resultado="sem_acesso", tentativa=1) for t in todos[:3]]})
        return dict(linha, desfecho="sem_acesso")
    cx = Conferencia(cf, site, conf, cli, rclone, sufixo, contador, env)
    cx.execucao_id = plano["execucao_id"]
    desfecho = None
    try:
        local, primeiros = cx.controle(plano)
        if modo == "prova":
            for r in primeiros:
                print("PROVA: %s %s" % (r["arquivo_id"], r["resultado"]))
            return dict(linha, desfecho="ok" if local else "controle_falhou", contagens=dict(cx.n))
        d = cx.informar(primeiros)
        ex = d.get("execucao") or {}
        estado = ex.get("estado")
        canario_ok = ex.get("canario_ok") or {}
        linha["canario_ok"] = {f: canario_ok.get(f) is True for f in c.FILHOS}
        if any(r["resultado"] == "sem_acesso" for r in primeiros):
            desfecho = "sem_acesso"             # C2 r2: controle sem_acesso fica pendente; não é controle_falhou
        elif not local or estado != "controle_ok":
            desfecho = "controle_falhou"
        elif any(plano["estado"][f] == "nada_devido" and not linha["canario_ok"][f] for f in c.FILHOS):
            desfecho = "controle_falhou"        # C2 r2: nada_devido só é verde com o canário do mesmo filho aceito agora
        else:
            pagina, cursor_atual = plano, None
            while True:
                try:
                    cx.arquivos(pagina["arquivos"])
                except Vencida:
                    # X1 da r2.1: pede o plano de novo com o cursor com que pediu a última página aceita (None = a primeira)
                    # e retoma dali, nunca do zero; o que já foi aceito fica em cx.feitos e não é baixado de novo.
                    # Execução nova (outro execucao_id) refaz o controle negativo e os dois canários antes dos arquivos.
                    cx.renovacoes += 1
                    if cx.renovacoes > 3 or cx.acabou_o_tempo():
                        cx.parcial = True
                        break
                    nova = site.dados("GET", "plan", consulta=dict(consulta, **({"cursor": cursor_atual} if cursor_atual else {})))
                    if not (isinstance(nova, dict) and isinstance(nova.get("execucao_id"), str) and c.RE_UUID.match(nova["execucao_id"])
                            and isinstance(nova.get("arquivos"), list)):
                        cx.invalido = True
                        break
                    if nova["execucao_id"] != cx.execucao_id:
                        cx.execucao_id = nova["execucao_id"]
                        # r2.1: execução nova traz outro controle negativo e canários pendentes: o controle é o dela
                        ok2, prim2 = cx.controle(validar_plano(nova) if "controle_negativo" in nova else plano)
                        d2 = cx.informar(prim2)
                        if not ok2 or (d2.get("execucao") or {}).get("estado") != "controle_ok":
                            desfecho = "controle_falhou"
                            break
                    linha["execucao_id"] = cx.execucao_id
                    pagina = dict(nova, cursor_seguinte=nova.get("cursor_seguinte", pagina.get("cursor_seguinte")))
                    continue
                cursor = pagina.get("cursor_seguinte")
                if not cursor or cx.acabou_o_tempo() or cx.teto:
                    break
                cursor_atual = cursor
                pagina = site.dados("GET", "plan", consulta=dict(consulta, cursor=cursor))
                if (pagina.get("execucao_id") != cx.execucao_id or not isinstance(pagina.get("arquivos"), list)
                        or len(pagina["arquivos"]) > 500):
                    cx.invalido = True
                    break
                linha["pedidos"] += len(pagina["arquivos"])
                if "cobertura" in pagina:       # r2.2: a página traz a cobertura do momento; a linha guarda a última
                    if not cobertura_valida(plano["modo"], plano["retomado_de"], pagina["cobertura"]):
                        cx.invalido = True
                        break
                    linha["cobertura"] = pagina["cobertura"]
    except TetoAtingido:
        desfecho = "teto_bytes"                 # m3: teto nos canários não é controle_falhou
    except ArquivoDesligado:
        desfecho = "arquivo_desligado"
    except ChaveRecusada:
        desfecho = "chave"
    except Recusa as e:
        cx.n["recusa_" + (e.code or str(e.status))] += 1
        cx.invalido = True
    except ErroDoSite:
        desfecho = "site_fora"                  # Yannis I1: 502 no meio não vira bug; a linha leva as contagens
        cx.parcial = True
    except c.Cortado:
        desfecho = "timeout"
        cx.parcial = True
    finally:
        shutil.rmtree(cx.tmp, ignore_errors=True)
    if estado_saida is not None:
        estado_saida["parado_no_teto"] = contador.qual_teto() if (cx.teto or desfecho == "teto_bytes") else None
    linha.update(informados=cx.informados, parcial=cx.parcial, bytes_dia=contador.d["bytes_dia"], bytes_mes=contador.d["bytes_mes"],
                 contagens=dict(cx.n))
    if cx.teto or desfecho == "teto_bytes":
        linha["teto"] = contador.qual_teto()
    if linha["pedidos"] == 0:
        e = set(plano["estado"].values())
        # O estado vem do site (K4); a linha o copia para o bloco do pulso. Nunca deduzido de pedidos == 0.
        if e == {"aguardando_primeira_selagem"}:
            linha["estado"] = "aguardando_primeira_selagem"
        elif e <= {"aguardando_primeira_selagem", "nada_devido"}:
            linha["estado"] = "nada_devido"
    return dict(linha, desfecho=desfecho or desfecho_de(cx, linha))


def batimento(cf, site, parado_no_teto=None):
    """C8 r2: o trabalhador vem da chave (conferir_b2); os campos de NAS vão com a verdade da montagem de escrita
    (só para a página: o silêncio e a varredura são só do copiador). parado_no_teto: 'dia', 'mes' ou nulo.
    Devolve a cor do teto que o site respondeu (C8 r2.2), ou None."""
    estados = {f: c.estado_filho(cf["escrita"], f) for f in c.FILHOS}
    try:
        d = site.dados("POST", "heartbeat", c.corpo_batimento(cf["base"], estados, parado_no_teto))
    except ErroDoSite:
        return None
    # r2.2 (M6 do Phil): a cor do teto vem do site, que conta os dias seguidos pelo histórico das execuções.
    # Resposta sem cor, ou com cor fora da lista: None (o pulso trata teto_bytes sem cor como vermelho).
    t = d.get("teto") if isinstance(d, dict) else None
    return t if t in CORES_TETO else None


def limpar_sobras(cf):
    """Yannis I11: o SIGKILL do `timeout -k` não passa pelo finally; texto decifrado (comentários) não fica na forja.
    Roda sob o flock do cron, antes de qualquer pasta nova. Só as pastas do próprio conferir-b2."""
    n = 0
    for p in glob.glob(os.path.join(cf["estado"], "conferir-b2-*")):
        if os.path.isdir(p):
            shutil.rmtree(p, ignore_errors=True)
            n += 1
    return n


def main(argv=None, env=None, rclone=None, b2_base="https://api.backblazeb2.com"):
    a = argparse.ArgumentParser(description="conferir-b2 do arquivo (M3b)")
    g = a.add_mutually_exclusive_group(required=True)
    for m in ("cron", "prova", "completo"):
        g.add_argument("--" + m, dest="modo", action="store_const", const=m)
    modo = a.parse_args(argv).modo
    amb = c.ambiente(PROGRAMA, env)
    cf = c.config(PROGRAMA, amb)
    rclone = rclone or B.rclone_padrao(amb)
    os.makedirs(cf["estado"], exist_ok=True)
    t0 = time.monotonic()
    try:
        c.instalar_sigterm()
        limpos = limpar_sobras(cf)
        chave = c.ler_chave(cf["chave"])
        if cf["erro_config"]:
            linha = {"modo": modo, "desfecho": "bug", "erro": cf["erro_config"]}
        elif amb.get("OBS_ARQUIVO_CONFERIR_B2") != "on":
            linha = {"modo": modo, "desfecho": "desligado"}
        elif chave is None:
            linha = {"modo": modo, "desfecho": "chave"}
        else:
            site = Site(cf["site"], chave, intervalo=cf["ritmo_s"])
            saida = {}
            linha = executar(cf, site, modo, rclone, amb, b2_base, saida)
            if modo != "prova" and linha["desfecho"] != "timeout":
                linha["teto_cor"] = batimento(cf, site, saida.get("parado_no_teto"))
        if limpos:
            linha["tmp_limpo"] = limpos
    except c.Cortado:
        linha = {"modo": modo, "desfecho": "timeout", "parcial": True}
    except Exception as e:
        traceback.print_exc()
        linha = {"modo": modo, "desfecho": "bug", "erro": type(e).__name__}
    linha["rclone"] = rclone
    linha["duracao_s"] = round(time.monotonic() - t0, 1)
    c.registrar(cf["log"], linha)
    print("conferir-b2: %s" % linha["desfecho"])
    return 0 if linha["desfecho"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar e ver passar (menos os dois modelos)**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_conferir_b2.py 2>/dev/null | grep -E "^FALHA|falha\(s\)"`
Expected: só a linha `FALHA o modelo do .env nasce desligado e sem segredo` e `conferir-b2: 1 falha(s)` (os modelos nascem na Tarefa 6).

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/conferir-b2/conferir.py arquivo/teste_conferir_b2.py
git -C $K commit -m "feat: arquivo M3b, o conferir-b2 (controle negativo e canários primeiro, fileId da API v4 do B2, nao_decifra, estado do site, teto do dia e do mês, retomada da execução vencida)" -- arquivo/conferir-b2/conferir.py arquivo/teste_conferir_b2.py
```

---

### Task 5: restaurar do B2 pelo `fileId` (P24, Su1)

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/restaurar_do_b2.py`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_restaurar.py`

**Interfaces:**
- Consumes: `estado/aguardando_dono.json` (D-F14; os itens `aguardando_dono` do C1, com `b2_file_id_bom`); `b2.py`; `comum.py`.
- Produces: `restaurar_do_b2.main(argv, env, rclone=None, b2_base, eh_montagem) -> int`; linhas `RESTAURADO: <filho>/<caminho> sha256=<hex> bytes=<n> (fileId <id>)`, `JA-EM-RECEBENDO`, `QUARENTENA`, `SEM-VERSAO-BOA-NO-B2` (também quando o `fileId` atestado responde 404), `NADA-A-RESTAURAR`, `PARE: <motivo>`. Roda sob a trava do copiador (`m3b-restaurar.sh`).

**O que acontece quando o dado não existe:** sem `aguardando_dono.json`: `PARE` (nunca "nada a restaurar"); item sem `b2_file_id_bom`: `SEM-VERSAO-BOA-NO-B2` (é a decisão digitada do dono, `declarar-perdida`, `02` §10.5); filho desmontado: `PARE`, nada gravado. **Quando dá erro:** `fileId` de outro arquivo (o `x-bz-file-name` não bate): `PARE`; versão que não decifra: `PARE`; `fileId` que não existe mais (404): `SEM-VERSAO-BOA-NO-B2`; final existente: `PARE` sem `--quarentena`; com `--quarentena`, o final só vai para `_recebendo/_quarentena/` **depois** de a versão do B2 ter sido baixada, decifrada e conferida (B2 fora nunca deixa o NAS sem o arquivo).

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_restaurar.py`:

```python
"""M3b: prova o restaurar_do_b2.py (item 172: 'duas versões no B2 falso, a restauração traz a anterior').
Uso: python3 teste_restaurar.py"""
import io, json, os, sys, tempfile
from contextlib import redirect_stdout

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import comum as c  # noqa: E402
import falsos as F  # noqa: E402
import restaurar_do_b2 as R  # noqa: E402

falhas = []
CANAL = "0b6f3c2e-6a51-4c1e-9d0e-6f2b1a7c9e10"
REL = c.caminho_unidade("serie", CANAL, "competitor_video_daily", "2026-01", 1)[1]
BOM, RUIM = F.gz("id,views\n1,10\n"), F.gz("id,views\n1,99\n")


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def caso():
    tmp = tempfile.mkdtemp(prefix="restaurar-")
    base, esc = os.path.join(tmp, "opt"), os.path.join(tmp, "mnt")
    for f in c.FILHOS:
        os.makedirs(os.path.join(esc, f))
        open(os.path.join(esc, f, c.SENTINELA), "w").close()
    os.makedirs(os.path.join(base, "estado"))
    fb = F.B2Falso()
    rc, envf = F.rclone_falso(os.path.join(tmp, "bin"), F.dump_bom())
    nome = "site-arquivo/numerico/%s.bin" % REL
    id_bom = fb.por(nome, F.cifrar("s3nh4", BOM), ts=1)
    id_ruim = fb.por(nome, F.cifrar("s3nh4", RUIM), ts=2)
    env = dict(os.environ, **envf, ARQUIVO_BASE=base, ARQ_MONTAGEM_ESCRITA=esc, ARQ_ENV="/nao/existe")
    return tmp, base, esc, fb, rc, env, id_bom, id_ruim


def rodar(args, rc, env, fb, montado=True):
    out = io.StringIO()
    with redirect_stdout(out):
        code = R.main(args, env=env, rclone=rc, b2_base=fb.url, eh_montagem=lambda p: montado)
    return code, out.getvalue()


tmp, base, esc, fb, rc, env, id_bom, id_ruim = caso()
code, out = rodar(["--file-id", id_bom, "--filho", "numerico", "--caminho", REL], rc, env, fb)
dest = os.path.join(esc, "numerico", c.nome_recebendo(REL))
exige(code == 0 and "RESTAURADO" in out and open(dest, "rb").read() == BOM, "traz a versão do fileId atestado, não a mais recente (item 172)")
exige(not os.path.exists(os.path.join(esc, "numerico", REL)), "grava só em _recebendo: o copiador confere e move")
code, out = rodar(["--file-id", id_bom, "--filho", "numerico", "--caminho", REL], rc, env, fb)
exige(code == 0 and "JA-EM-RECEBENDO" in out, "repetir não refaz nem sobrescreve")
fb.srv.parar()

tmp, base, esc, fb, rc, env, id_bom, id_ruim = caso()
final = os.path.join(esc, "numerico", REL)
os.makedirs(os.path.dirname(final))
open(final, "wb").write(RUIM)
code, out = rodar(["--file-id", id_bom, "--filho", "numerico", "--caminho", REL], rc, env, fb)
exige(code == 1 and "PARE" in out and open(final, "rb").read() == RUIM, "final existente: para sem --quarentena e não toca nele")
code, out = rodar(["--file-id", id_bom, "--filho", "numerico", "--caminho", REL, "--quarentena"], rc, env, fb)
q = [os.path.join(r, n) for r, _, ns in os.walk(os.path.join(esc, "numerico", "_recebendo", "_quarentena")) for n in ns]
exige(code == 0 and len(q) == 1 and open(q[0], "rb").read() == RUIM and not os.path.exists(final), "--quarentena: o ruim vai para _recebendo/_quarentena (nada é apagado)")
exige(open(os.path.join(esc, "numerico", c.nome_recebendo(REL)), "rb").read() == BOM, "e o bom fica em _recebendo")
fb.srv.parar()

tmp, base, esc, fb, rc, env, id_bom, id_ruim = caso()
final = os.path.join(esc, "numerico", REL)
os.makedirs(os.path.dirname(final))
open(final, "wb").write(RUIM)
fb.fora = True
code, out = rodar(["--file-id", id_bom, "--filho", "numerico", "--caminho", REL, "--quarentena"], rc, env, fb)
exige(code == 1 and "PARE" in out and open(final, "rb").read() == RUIM and "QUARENTENA" not in out,
      "--quarentena com o B2 fora: o final continua no lugar (Yannis I9)")
fb.fora = False
code, out = rodar(["--file-id", "4_z" + "0" * 24 + "_f001_sumiu", "--filho", "numerico", "--caminho", REL, "--quarentena"], rc, env, fb)
exige(code == 1 and "SEM-VERSAO-BOA-NO-B2" in out and open(final, "rb").read() == RUIM,
      "fileId atestado que não existe mais (404): SEM-VERSAO-BOA-NO-B2, e o final continua no lugar (M4 do Phil)")
os.makedirs(os.path.join(base, "estado", "restaurar-velho"))
rodar(["--do-plano"], rc, env, fb)
exige(not os.path.exists(os.path.join(base, "estado", "restaurar-velho")), "sobra de uma restauração morta sai (Yannis I11)")
fb.srv.parar()

tmp, base, esc, fb, rc, env, id_bom, id_ruim = caso()
outro = fb.por("site-arquivo/numerico/outro.bin", F.cifrar("s3nh4", b"x"))
for rotulo, args, montado in (("fileId de outro arquivo", ["--file-id", outro, "--filho", "numerico", "--caminho", REL], True),
                              ("caminho fora da árvore", ["--file-id", id_bom, "--filho", "numerico", "--caminho", "../x"], True),
                              ("filho trocado", ["--file-id", id_bom, "--filho", "texto", "--caminho", REL], True),
                              ("NAS fora", ["--file-id", id_bom, "--filho", "numerico", "--caminho", REL], False)):
    code, out = rodar(args, rc, env, fb, montado)
    exige(code == 1 and "PARE" in out and not os.path.exists(os.path.join(esc, "numerico", c.nome_recebendo(REL))), "recusa: " + rotulo)
c.trocar_atomico(os.path.join(base, "estado", "aguardando_dono.json"), json.dumps([
    {"filho": "numerico", "caminho": REL, "b2_file_id_bom": id_bom}, {"filho": "numerico", "caminho": "x", "b2_file_id_bom": None}]).encode())
code, out = rodar(["--do-plano"], rc, env, fb)
exige(code == 0 and "RESTAURADO" in out and "SEM-VERSAO-BOA-NO-B2: x" in out, "--do-plano: restaura o que tem fileId bom e lista o que não tem")
os.unlink(os.path.join(base, "estado", "aguardando_dono.json"))
code, out = rodar(["--do-plano"], rc, env, fb)
exige(code == 2 and "PARE" in out, "--do-plano sem o arquivo do copiador: para, nunca 'nada a restaurar'")
fb.srv.parar()

print("\nrestaurar: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_restaurar.py`
Expected: `ModuleNotFoundError: No module named 'restaurar_do_b2'`, saída 1.

- [ ] **Step 3: Escrever a ferramenta**

`arquivo/restaurar_do_b2.py`:

```python
"""M3b (forja): traz do B2, pelo fileId, a versão boa de um arquivo para _recebendo/ do filho (P24; Su1, 02 §10.10).
É ferramenta do DONO (escrita no NAS): nenhum programa restaura sozinho (02 §10.6).

Uso, na forja (pelo m3b-restaurar.sh):
  /usr/bin/python3 -B /opt/arquivo/restaurar_do_b2.py --do-plano [--quarentena]
      todos os itens de estado/aguardando_dono.json (gravado pelo copiador) que têm b2_file_id_bom
  /usr/bin/python3 -B /opt/arquivo/restaurar_do_b2.py --file-id <id> --filho <numerico|texto> --caminho <relativo> [--quarentena]

Traz a versão do fileId que a última conferência boa registrou, NUNCA a mais recente: a cópia agendada do NAS pode ter
subido o arquivo estragado. Grava em _recebendo/<caminho>; o copiador confere e move na execução seguinte.
Caminho final existente não é sobrescrito: sem --quarentena, para; com ela, o arquivo ruim vai para
_recebendo/_quarentena/<caminho>.<carimbo> (fora da cópia para o B2, e nenhum programa apaga), e SÓ DEPOIS de a
versão do B2 ter sido baixada, decifrada e conferida pelo nome (Yannis I9: B2 fora nunca deixa o NAS sem o arquivo).
Roda sob a trava do copiador (m3b-restaurar.sh: flock -n /opt/arquivo/copiador.lock; M4 do Phil)."""
import argparse, glob, json, os, shutil, sys, tempfile, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b2 as B  # noqa: E402
import comum as c  # noqa: E402


def restaurar(alvo, cf, conf, cli, rclone, sufixo, env, quarentena, eh_montagem=os.path.ismount):
    filho, rel, fid = alvo["filho"], alvo["caminho"], alvo["file_id"]
    if c.analisar(rel) != (filho, rel):
        return "PARE: caminho fora da árvore: %s" % rel
    if not B.RE_FILE_ID.match(str(fid)):
        return "PARE: fileId fora do formato: %s" % fid
    e = c.estado_filho(cf["escrita"], filho, eh_montagem)
    if not (e["montado"] and e["sentinela"]):
        return "PARE: %s não montado ou sem sentinela (nada gravado)" % filho
    final, destino = os.path.join(e["raiz"], rel), os.path.join(e["raiz"], c.nome_recebendo(rel))
    if os.path.lexists(destino):
        return "JA-EM-RECEBENDO: %s (o copiador confere na próxima execução)" % rel
    if os.path.lexists(final) and not quarentena:
        return "PARE: o caminho final existe (%s); o ruim não é sobrescrito. Repita com --quarentena" % rel
    tmp = tempfile.mkdtemp(prefix="restaurar-", dir=cf["estado"])
    try:
        cifrado = os.path.join(tmp, "cif", rel + sufixo)
        n, nome = cli.baixar(fid, cifrado, 10 ** 12)
        if nome != B.nome_b2(conf, filho, rel, sufixo):
            return "PARE: o fileId é de outro arquivo no B2 (%s)" % nome
        ok = B.decifrar(rclone, conf, os.path.join(tmp, "cif"), [rel], os.path.join(tmp, "claro"), sufixo, env)
        if not ok.get(rel):
            return "PARE: a versão %s não decifra com a chave da forja" % fid
        dados = open(os.path.join(tmp, "claro", rel), "rb").read()
        if os.path.lexists(final):              # só agora, com a versão boa em mãos, o ruim sai do lugar
            q = os.path.join(e["raiz"], "_recebendo", "_quarentena", rel + "." + time.strftime("%Y%m%d%H%M%S"))
            os.makedirs(os.path.dirname(q), exist_ok=True)
            os.rename(final, q)
            print("QUARENTENA: %s -> %s" % (rel, os.path.relpath(q, e["raiz"])))
        c.gravar_atomico(destino, dados)
        sha, tam = c.sha256_arquivo(destino)
        return "RESTAURADO: %s/%s sha256=%s bytes=%d (fileId %s)" % (filho, rel, sha, tam, fid)
    except B.ErroB2 as x:
        if x.status == 404:                     # M4 do Phil: é a prova que o dono usa para declarar-perdida
            return "SEM-VERSAO-BOA-NO-B2: %s (o fileId atestado %s não existe mais no bucket)" % (rel, fid)
        return "PARE: B2 sem acesso (%s)" % x
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main(argv=None, env=None, rclone=None, b2_base="https://api.backblazeb2.com", eh_montagem=os.path.ismount):
    a = argparse.ArgumentParser(description="restaurar do B2 pelo fileId (M3b, P24)")
    a.add_argument("--do-plano", action="store_true")
    a.add_argument("--file-id")
    a.add_argument("--filho", choices=c.FILHOS)
    a.add_argument("--caminho")
    a.add_argument("--quarentena", action="store_true")
    o = a.parse_args(argv)
    amb = c.ambiente("conferir-b2", env)
    cf = c.config("conferir-b2", amb)
    rclone = rclone or B.rclone_padrao(amb)
    for velho in glob.glob(os.path.join(cf["estado"], "restaurar-*")):   # Yannis I11: sobra de uma execução morta
        shutil.rmtree(velho, ignore_errors=True)
    if o.do_plano:
        try:
            itens = json.load(open(os.path.join(cf["estado"], "aguardando_dono.json")))
        except (OSError, ValueError):
            print("PARE: sem estado/aguardando_dono.json legível (o copiador ainda não rodou?)")
            return 2
        alvos = [{"filho": i.get("filho"), "caminho": i.get("caminho"), "file_id": i.get("b2_file_id_bom")}
                 for i in itens if isinstance(i, dict) and i.get("b2_file_id_bom")]
        sem = [i.get("caminho") for i in itens if isinstance(i, dict) and not i.get("b2_file_id_bom")]
        for s in sem:
            print("SEM-VERSAO-BOA-NO-B2: %s (o site não tem conferência boa: decisão do dono, declarar-perdida)" % s)
    elif o.file_id and o.filho and o.caminho:
        alvos = [{"filho": o.filho, "caminho": o.caminho, "file_id": o.file_id}]
    else:
        a.error("use --do-plano, ou --file-id, --filho e --caminho")
    if not alvos:
        print("NADA-A-RESTAURAR")
        return 0
    try:
        conf = B.remotos(rclone, amb)
        cli = B.B2(conf["conta"], conf["chave"], conf["bucket"], base=b2_base).autorizar()
    except (B.ConfigB2, B.ErroB2) as x:
        print("PARE: sem acesso ao B2 pela forja (%s)" % x)
        return 1
    os.makedirs(cf["estado"], exist_ok=True)
    saidas = [restaurar(t, cf, conf, cli, rclone, amb.get("ARQ_B2_SUFIXO") or ".bin", amb, o.quarentena, eh_montagem) for t in alvos]
    for s in saidas:
        print(s)
    return 0 if all(s.startswith(("RESTAURADO", "JA-EM-RECEBENDO")) for s in saidas) else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_restaurar.py | tail -1`
Expected: `restaurar: 0 falha(s)`.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/restaurar_do_b2.py arquivo/teste_restaurar.py
git -C $K commit -m "feat: arquivo M3b, restaurar do B2 pelo fileId da última conferência boa, para _recebendo (P24, Su1)" -- arquivo/restaurar_do_b2.py arquivo/teste_restaurar.py
```

---

### Task 6: modelos de `.env`, relógio e o teste de tudo

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/copiador.env.modelo`, `arquivo/conferir-b2.env.modelo`, `arquivo/relogio_forja.sh`, `arquivo/teste_tudo.sh`
- Modify: `~/Workspace/forja/ferramentas/arquivo/pulso_arquivo.py`, `arquivo/teste_pulso_arquivo.py` (da M3a; ainda não instalados na forja: o bloco 5 desta etapa os instala)

**Interfaces:**
- Consumes: `comum.carregar_env`; os testes da M3a (`teste_pulso_arquivo.py`, `teste_montagens.py`, `teste_nova_chave_arquivo.py`, `teste_configurar_rclone.py`, `teste_instalar_casa.sh`, `teste_seed_arquivo.sh`).
- Produces: `bash arquivo/teste_tudo.sh` (saída 0 só com os onze passando **no Python 3.12**; teste que falta conta como falha; sem `python3.12` no Mac, `PARE`); `relogio_forja.sh` (última linha `RELOGIO: SINCRONIZADO` ou `RELOGIO: NAO-SINCRONIZADO`); o bloco do B2 no pulso aceita `estado: "nada_devido"` com `pedidos: 0` (K4) e fica verde com `teto_bytes` só quando `teto_cor` é `ambar` (r2.2); `pulso_arquivo.py --stdin` lê as três URLs da entrada (m2).

**Antes:** no Mac, `python3.12 --version` diz `Python 3.12.x`; sem ele, `uv python install 3.12` (ou `brew install python@3.12`) e, se o executável não estiver no `PATH` como `python3.12`, `export ARQ_PY=<caminho>`.

- [ ] **Step 1: Escrever os quatro arquivos**

`arquivo/copiador.env.modelo`:

```
# /opt/arquivo/copiador.env (0600). Nasce deste modelo com cp -n: uma reinstalação não o apaga.
# Nenhum segredo aqui: a chave do copiador mora em /opt/arquivo/chaves/copiador.chave (M3a).
# Toda variável tem padrão e um teste que a apaga (item 79). Descomente só para mudar.
# ARQ_SITE=https://bythiagofigueiredo.com
# ARQ_MONTAGEM_ESCRITA=/mnt/arquivo/escrita
# ARQ_ORCAMENTO_S=2100
# ARQ_RITMO_S=0.67
```

`arquivo/conferir-b2.env.modelo`:

```
# /opt/arquivo/conferir-b2.env (0600). Nasce deste modelo com cp -n: uma reinstalação não o apaga.
# Nenhum segredo aqui: a chave de API mora em /opt/arquivo/chaves/conferidor.chave (M3a); a do B2 e a da
# cifra, no rclone.conf da forja (M3a, configurar_rclone.py).
# Só "on" liga (spec 02 §10.9). O dono liga com o m3b-forja-2-ligar-e-provar.sh, depois da instalação.
OBS_ARQUIVO_CONFERIR_B2=off
# Toda variável abaixo tem padrão e um teste que a apaga (item 79). Descomente só para mudar.
# ARQ_B2_BANDA_KIBPS=1024
# ARQ_B2_SUFIXO=.bin
# ARQ_SITE=https://bythiagofigueiredo.com
# ARQ_ORCAMENTO_S=2100
# ARQ_RITMO_S=0.67
# ARQ_RCLONE=/usr/local/bin/rclone   (padrão: o primeiro executável entre /usr/local/bin/rclone e /usr/bin/rclone)
```

`arquivo/relogio_forja.sh`:

```bash
#!/bin/bash
# M3b: o relógio da forja (spec 05 §16.11 passo 5; P39). Lê; se o NTP não está sincronizado, liga e lê de novo.
# Roda NA FORJA, aberto com ssh -t (o sudo pede a senha da forja, que o dono digita e nunca vai para arquivo):
#   ssh -t forja 'bash /opt/arquivo/ferramentas/relogio_forja.sh'
# Saída boa: a última linha é "RELOGIO: SINCRONIZADO".
estado() { timedatectl show -p NTPSynchronized --value 2>/dev/null; }
echo "--- antes"
timedatectl status
if [ "$(estado)" != "yes" ]; then
  echo "--- NTP não sincronizado: ligando"
  sudo timedatectl set-ntp true
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do [ "$(estado)" = "yes" ] && break; sleep 5; done
  echo "--- depois"
  timedatectl status
fi
[ "$(estado)" = "yes" ] && echo "RELOGIO: SINCRONIZADO" || echo "RELOGIO: NAO-SINCRONIZADO"
```

`arquivo/teste_tudo.sh`:

```bash
#!/bin/bash
# M3b: roda todos os testes do arquivo (os da M3a e os da M3b), um atrás do outro, e diz o total.
# Uso (no Mac): bash ~/Workspace/forja/ferramentas/arquivo/teste_tudo.sh      Saída 0 só com tudo passando.
# Teste que FALTA conta como falha: a M3b só se instala depois da M3a, com o kit inteiro.
# Os testes rodam no Python da FORJA (3.12): o 3.14 do Mac aprovou um leitor que a 3.12 reprova (crítico 1 do Yannis).
# Sem o 3.12 no Mac: `uv python install 3.12` (ou brew install python@3.12) e ARQ_PY apontando para ele.
cd "$(dirname "$0")" || exit 2
PY="${ARQ_PY:-$(command -v python3.12)}" || true
[ -n "$PY" ] || { echo "PARE: falta python3.12 (uv python install 3.12, ou brew install python@3.12)"; exit 2; }
"$PY" -c 'import sys; assert sys.version_info[:2] == (3, 12)' || { echo "PARE: $PY não é o Python 3.12"; exit 2; }
SAIDA=$(mktemp -d)
falhas=0
for t in teste_comum.py teste_site_b2.py teste_copiador.py teste_conferir_b2.py teste_restaurar.py \
         teste_pulso_arquivo.py teste_montagens.py teste_nova_chave_arquivo.py teste_configurar_rclone.py \
         teste_instalar_casa.sh teste_seed_arquivo.sh; do
  if [ ! -f "$t" ]; then echo "FALTA  $t"; falhas=$((falhas + 1)); continue; fi
  case "$t" in *.py) cmd=("$PY" -B "$t") ;; *) cmd=(bash "$t") ;; esac
  if "${cmd[@]}" >"$SAIDA/$t.txt" 2>&1; then echo "PASSOU $t"; else echo "FALHOU $t"; grep -E "^FALHA|Error|PARE" "$SAIDA/$t.txt" | head -5; falhas=$((falhas + 1)); fi
done
rm -rf "$SAIDA"
echo "arquivo: $falhas teste(s) falhando"
[ "$falhas" -eq 0 ]
```

- [ ] **Step 2: As três mudanças no `pulso_arquivo.py` da M3a e no teste dele** (`nada_devido`; `--stdin`; r2.2: `teto_bytes` pela `teto_cor` do site, com o teste de fronteira dia 1 âmbar, dia 2 vermelho, dia 3 sem estouro verde)

`arquivo/pulso_arquivo.py` (diff sobre o da M3a):

```diff
7a8,9
>     printf '%s\n' U1 U2 U3 | python3 pulso_arquivo.py --stdin                              -> idem, URLs pela entrada
>         (M3b, m2 do Yannis: as URLs fora do argv, que aparece no `ps`)
65a68,75
>     # M3b (contrato r2.2, M6 do Phil): teto de bytes é âmbar no primeiro dia e vermelho no segundo dia seguido.
>     # Quem conta os dias é o SITE, pelo histórico das execuções; a cor volta no batimento e a linha a guarda em
>     # teto_cor. O pulso não conta nada: âmbar não alerta; vermelho, ou sem cor (batimento que falhou), é falha.
>     if desfecho == "teto_bytes":
>         cor = ultima[1].get("teto_cor")
>         if cor == "ambar":
>             return PREFIXO + "-ok"
>         return "%s-teto_bytes-%s" % (PREFIXO, "2-dias" if cor == "vermelho" else "sem-cor")
74,75c84,87
<         # Sem arquivo pedido o verde só diz que os controles passaram: exige o estado explícito (nunca "ok" mudo).
<         if pedidos == 0 and ultima[1].get("estado") != "aguardando_primeira_selagem":
---
>         # Sem arquivo pedido o verde só diz que os controles passaram: exige o estado explícito do SITE (nunca "ok" mudo).
>         # M3b (contrato r2, K4): nada_devido também vale; o conferir-b2 só escreve "ok" com ele se o canário do mesmo
>         # filho foi aceito na mesma execução.
>         if pedidos == 0 and ultima[1].get("estado") not in ("aguardando_primeira_selagem", "nada_devido"):
195c207
<     urls = argv[1:]
---
>     urls = sys.stdin.read().split() if argv[1:2] == ["--stdin"] else argv[1:]
```

`arquivo/teste_pulso_arquivo.py` (diff sobre o da M3a):

```diff
--- ../../teste_pulso_arquivo.orig.py
+++ teste_pulso_arquivo.py
@@ -118,8 +118,20 @@
 caso(B, "chave_ausente", jsonl("b5.jsonl", [lin(2, "chave_ausente")]), "arquivo-b2-chave_ausente")
 # Antes da primeira selagem não há mês para conferir: verde só com o estado explícito; sem ele, vermelho (falha em verde).
 caso(B, "pedidos-zero-e-ok", jsonl("b6.jsonl", [dict(lin(20), pedidos=0, informados=0, estado="aguardando_primeira_selagem")]), "")
+caso(B, "pedidos-zero-nada-devido", jsonl("b6n.jsonl", [dict(lin(20), pedidos=0, informados=0, estado="nada_devido")]), "")
+caso(B, "pedidos-zero-estado-desconhecido", jsonl("b6x.jsonl", [dict(lin(20), pedidos=0, informados=0, estado="com_pedidos")]), "arquivo-b2-pedidos-0-sem-estado")
 caso(B, "pedidos-zero-sem-estado", jsonl("b7.jsonl", [dict(lin(20), pedidos=0, informados=0)]), "arquivo-b2-pedidos-0-sem-estado")
 caso(B, "pedidos-3-informados-0", jsonl("b8.jsonl", [dict(lin(20, "incompleto"), pedidos=3, informados=0)]), "arquivo-b2-incompleto")
+# Teto de bytes (contrato r2.2, M6 do Phil): o SITE conta os dias seguidos e devolve a cor no batimento (teto_cor).
+# Fronteira, uma execução por dia: dia 1 âmbar (verde aqui, sem alerta), dia 2 vermelho, dia 3 sem estouro volta a verde.
+D1 = dict(lin(49), pedidos=2, informados=2, desfecho="teto_bytes", teto="dia", teto_cor="ambar")
+D2 = dict(lin(25), pedidos=2, informados=2, desfecho="teto_bytes", teto="dia", teto_cor="vermelho")
+caso(B, "teto-dia-1-ambar", jsonl("bt1.jsonl", [dict(D1, quando=obtido(1))]), "")
+caso(B, "teto-dia-2-vermelho", jsonl("bt2.jsonl", [D1, dict(D2, quando=obtido(1))]), "arquivo-b2-teto_bytes-2-dias")
+caso(B, "teto-dia-3-sem-estouro-verde", jsonl("bt3.jsonl", [D1, D2, dict(lin(1), pedidos=2, informados=2)]), "")
+caso(B, "teto-sem-cor", jsonl("bt4.jsonl", [dict(lin(1), pedidos=2, informados=2, desfecho="teto_bytes", teto="dia")]), "arquivo-b2-teto_bytes-sem-cor")
+caso(B, "teto-cor-verde-contradiz", jsonl("bt5.jsonl", [dict(lin(1), pedidos=2, informados=2, desfecho="teto_bytes", teto_cor="verde")]), "arquivo-b2-teto_bytes-sem-cor")
+caso(B, "ok-com-cor-ambar-velha-nao-importa", jsonl("bt6.jsonl", [dict(lin(1), pedidos=2, informados=2, teto_cor="ambar")]), "")
 
 # ---------- pulso do arquivo (plano com menos de 13 h e campo vermelhos) ----------
 P = "pulso_arquivo"
@@ -150,7 +162,10 @@
     tmp = tempfile.mkdtemp(prefix="pulsoarq-ida-")
     with open(os.path.join(tmp, "pulso.sh"), "w") as f:
         f.write(base)
-    r = subprocess.run([sys.executable, os.path.join(AQUI, "pulso_arquivo.py")] + list(args), cwd=tmp,
+    entrada = None
+    if args[:1] == ("--stdin",):
+        entrada, args = "".join(u + "\n" for u in args[1:]), ("--stdin",)
+    r = subprocess.run([sys.executable, os.path.join(AQUI, "pulso_arquivo.py")] + list(args), cwd=tmp, input=entrada,
                        capture_output=True, text=True, timeout=60)
     saida = os.path.join(tmp, "pulso.sh.tmp")
     return r, tmp, (open(saida).read() if os.path.exists(saida) else None)
@@ -175,6 +190,8 @@
                      ("url principal", [urls[0], U_PRINC, urls[2]])):
     r, _, nada = instala(BASE, *args)
     exige(r.returncode != 0 and nada is None, "recusa %s sem gravar" % rotulo)
+r, _, pelo_stdin = instala(BASE, "--stdin", *urls)
+exige(r.returncode == 0 and pelo_stdin == novo, "--stdin: as URLs pela entrada dão o mesmo pulso.sh.tmp (m2: fora do argv)")
 r, _, nada = instala(BASE.replace(pa.ANCORA, "true"), *urls)
 exige(r.returncode != 0 and nada is None, "sem âncora: recusa")
 r, _, nada = instala(BASE, "--remover")
```

Run: `python3.12 -B ~/Workspace/forja/ferramentas/arquivo/teste_pulso_arquivo.py | tail -1`
Expected: `pulso arquivo: 0 falha(s)`.

- [ ] **Step 3: Rodar**

Run: `bash -n ~/Workspace/forja/ferramentas/arquivo/relogio_forja.sh && bash ~/Workspace/forja/ferramentas/arquivo/teste_tudo.sh > /tmp/m3b-tudo.txt 2>&1; tail -13 /tmp/m3b-tudo.txt`
Expected: onze linhas `PASSOU` e `arquivo: 0 teste(s) falhando` (o `teste_conferir_b2.py` agora acha os dois modelos). Com a M3a incompleta aparece `FALTA <teste>`: é parar e terminar a M3a.

- [ ] **Step 4: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/copiador.env.modelo arquivo/conferir-b2.env.modelo arquivo/relogio_forja.sh arquivo/teste_tudo.sh arquivo/pulso_arquivo.py arquivo/teste_pulso_arquivo.py
git -C $K commit -m "feat: arquivo M3b, modelos dos .env (o do B2 nasce desligado), relógio, teste de tudo no Python 3.12, pulso aceita nada_devido, lê a cor do teto do site e URLs por stdin" -- arquivo/copiador.env.modelo arquivo/conferir-b2.env.modelo arquivo/relogio_forja.sh arquivo/teste_tudo.sh arquivo/pulso_arquivo.py arquivo/teste_pulso_arquivo.py
```

---

### Task 7: o `pode-desligar` (Mac, no site)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo/pode-desligar.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts`
- Test: `apps/web/test/youtube/observatorio/arquivo-pode-desligar.test.ts`

**Interfaces:**
- Consumes: contrato C11 (`public.obs_archive_pode_desligar(p_site uuid) returns jsonb`, criada pelo plano do site, Tarefa 7 de lá; `execute` também para `postgres`); `ClienteSql`, `rodar`, `interpretar`, `USO`, `DepsDoComando`, `Saida` de `cli.ts`; `arquivo-fakes.ts` (`SITE`, `AGORA`, `discoFalso`, `baixarFalso`).
- Produces: `lerPodeDesligar(bruto: unknown): LeituraPodeDesligar`; `frasesPodeDesligar(l): { codigo: 0 | 1; saida: string[] }`; `COMANDO_CONFERIR_B2_COMPLETO`; o subcomando `npx tsx scripts/obs-arquivo.ts pode-desligar [--site <uuid>]` (0 = "PODE DESLIGAR"; 1 = pendência ou leitura que não se entende; 2 = argumento).

**Trava:** esta tarefa só entra no `staging` depois de a função `obs_archive_pode_desligar` existir na migration do lado do site (o teste é com banco falso, mas o comando chamaria uma função inexistente em produção e o dono leria "não consegui ler"; é o lado seguro, mas é ruído). `cli.ts` é da E10: confira `git log -1 -- apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` antes de editar e, se outra trilha o tiver mudado desde `c18bd8e11`, faça as edições abaixo sobre a versão nova.

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/test/youtube/observatorio/arquivo-pode-desligar.test.ts`:

```ts
// @vitest-environment node
/**
 * M3b (lado da forja): o `pode-desligar` (item 149, parte do comando; contrato C11). As contas de prazo (7 dias e 1 segundo,
 * 6 dias e 23 horas) são da função SQL, do lado do site; aqui: a forma da leitura, as frases e que o comando só lê.
 */
import { describe, it, expect } from 'vitest'
import { frasesPodeDesligar, lerPodeDesligar, COMANDO_CONFERIR_B2_COMPLETO } from '@/lib/youtube/observatorio/arquivo/pode-desligar'
import { interpretar, rodar, USO, type DepsDoComando } from '@/lib/youtube/observatorio/arquivo/cli'
import type { ClienteSql } from '@/lib/youtube/observatorio/arquivo/sessao'
import { SITE, AGORA, discoFalso, baixarFalso } from './arquivo-fakes'

const ENV = { OBS_ARQUIVO_DB_URL: 'postgresql://x:SENHA@db.example.test:5432/postgres', HOME: '/home/dono' }

function banco(resposta: unknown | Error) {
  const chamadas: string[] = []
  const sql: ClienteSql = {
    async query(texto) {
      chamadas.push(texto.trim())
      if (/obs_archive_pode_desligar\(\$1\)/.test(texto)) {
        if (resposta instanceof Error) throw resposta
        return { rows: [{ r: resposta }] }
      }
      return { rows: [] }
    },
  }
  return { sql, chamadas }
}

function deps(sql: ClienteSql): DepsDoComando {
  return { sql, disco: discoFalso().disco, baixar: baixarFalso().baixar, agora: () => AGORA, ehTerminal: false,
           perguntar: async () => '', versaoDoScript: 'teste' }
}

describe('lerPodeDesligar: a forma do contrato C11', () => {
  it('tudo em dia: pode desligar', () => {
    expect(frasesPodeDesligar(lerPodeDesligar({ pode: true, faltam: [] }))).toEqual({ codigo: 0, saida: expect.arrayContaining(['PODE DESLIGAR']) })
  })
  it('cada motivo vira uma linha com o que fazer', () => {
    const r = frasesPodeDesligar(lerPodeDesligar({ pode: false, faltam: [
      { motivo: 'automatico_armado', classe: null, tabela: null, mes: null, detalhe: null },
      { motivo: 'mes_nao_recebido', classe: 'serie', tabela: 'competitor_video_daily', mes: '2026-10', detalhe: null },
      { motivo: 'b2_vencido_mes_fora', classe: 'horaria', tabela: 'competitor_video_hourly', mes: '2027-01', detalhe: '7 d 0 h 0 min 1 s' },
    ] }))
    expect(r.codigo).toBe(1)
    expect(r.saida[0]).toContain('desarme')
    expect(r.saida[1]).toContain('serie competitor_video_daily 2026-10')
    expect(r.saida[2]).toContain(COMANDO_CONFERIR_B2_COMPLETO)
    expect(r.saida[3]).toBe('NÃO DESLIGUE AINDA (3 pendências)')
  })
  it.each([
    ['nulo', null],
    ['lista', []],
    ['sem pode', { faltam: [] }],
    ['pode em texto', { pode: 'true', faltam: [] }],
    ['sem faltam', { pode: true }],
    ['motivo desconhecido', { pode: false, faltam: [{ motivo: 'mudanca' }] }],
    ['pode com pendência', { pode: true, faltam: [{ motivo: 'automatico_armado' }] }],
    ['não pode sem pendência', { pode: false, faltam: [] }],
    ['mês em número', { pode: false, faltam: [{ motivo: 'mes_nao_recebido', mes: 202610 }] }],
  ])('%s: nunca "pode desligar"', (_, bruto) => {
    const r = frasesPodeDesligar(lerPodeDesligar(bruto))
    expect(r.codigo).toBe(1)
    expect(r.saida.join('\n')).not.toContain('PODE DESLIGAR')
  })
})

describe('o subcomando pode-desligar', () => {
  it('está no uso e pede a conexão direta', () => {
    expect(USO.join('\n')).toContain('pode-desligar')
    expect(interpretar(['pode-desligar'], { HOME: '/h' })).toEqual({ erro: expect.stringContaining('OBS_ARQUIVO_DB_URL') })
    expect(interpretar(['pode-desligar', '--site', SITE], ENV)).toEqual({ nome: 'pode-desligar', site: SITE })
  })
  it('só lê: transação somente leitura, a função e o rollback; nada mais', async () => {
    const b = banco({ pode: true, faltam: [] })
    const r = await rodar({ nome: 'pode-desligar', site: SITE }, deps(b.sql))
    expect(r.codigo).toBe(0)
    expect(b.chamadas).toEqual(['begin transaction read only', 'select public.obs_archive_pode_desligar($1) as r', 'rollback'])
  })
  it('erro do banco: recusado, nunca "pode desligar", e a mensagem do banco não sai', async () => {
    const b = banco(Object.assign(new Error('relation "x" does not exist SENHA'), { code: '42P01' }))
    const r = await rodar({ nome: 'pode-desligar', site: SITE }, deps(b.sql))
    expect(r.codigo).toBe(1)
    expect(r.saida.join('\n')).not.toMatch(/PODE DESLIGAR|SENHA/)
    expect(b.chamadas.at(-1)).toBe('rollback')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-pode-desligar.test.ts > /tmp/m3b-pd.txt 2>&1; tail -5 /tmp/m3b-pd.txt`
Expected: falha por `Failed to resolve import "@/lib/youtube/observatorio/arquivo/pode-desligar"`.

- [ ] **Step 3: Escrever a decisão pura**

`apps/web/src/lib/youtube/observatorio/arquivo/pode-desligar.ts`:

```ts
/**
 * M3b (lado da forja): a decisão do `pode-desligar` (spec 02 §10.10; contrato C11). Pura: recebe o jsonb de
 * `public.obs_archive_pode_desligar(p_site)` e devolve o que o comando imprime. Só `node:`/relativo (o `tsx` da raiz importa).
 *
 * Regra que não muda: leitura que não está na forma do contrato NUNCA vira "pode desligar" (o sistema falha em verde).
 */

export type MotivoPodeDesligar = 'automatico_armado' | 'mes_nao_recebido' | 'b2_vencido_mes_fora'
export interface FaltaPodeDesligar {
  motivo: MotivoPodeDesligar
  classe: string | null
  tabela: string | null
  mes: string | null
  detalhe: string | null
}
export type LeituraPodeDesligar = { ok: true; pode: boolean; faltam: FaltaPodeDesligar[] } | { ok: false; porque: string }

const MOTIVOS: ReadonlySet<string> = new Set(['automatico_armado', 'mes_nao_recebido', 'b2_vencido_mes_fora'])
export const COMANDO_CONFERIR_B2_COMPLETO =
  'bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-conferir-b2-completo.sh'

const textoOuNulo = (v: unknown): v is string | null => v === null || typeof v === 'string'

export function lerPodeDesligar(bruto: unknown): LeituraPodeDesligar {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return { ok: false, porque: 'a função não devolveu um objeto' }
  const r = bruto as Record<string, unknown>
  if (typeof r.pode !== 'boolean') return { ok: false, porque: 'sem o campo pode' }
  if (!Array.isArray(r.faltam)) return { ok: false, porque: 'sem a lista faltam' }
  const faltam: FaltaPodeDesligar[] = []
  for (const f of r.faltam as unknown[]) {
    if (typeof f !== 'object' || f === null) return { ok: false, porque: 'pendência que não é objeto' }
    const x = f as Record<string, unknown>
    if (typeof x.motivo !== 'string' || !MOTIVOS.has(x.motivo)) return { ok: false, porque: `motivo desconhecido: ${String(x.motivo)}` }
    const classe = x.classe ?? null
    const tabela = x.tabela ?? null
    const mes = x.mes ?? null
    const detalhe = x.detalhe ?? null
    if (!textoOuNulo(classe) || !textoOuNulo(tabela) || !textoOuNulo(mes) || !textoOuNulo(detalhe)) return { ok: false, porque: 'pendência com campo fora da forma' }
    faltam.push({ motivo: x.motivo as MotivoPodeDesligar, classe, tabela, mes, detalhe })
  }
  if (r.pode && faltam.length > 0) return { ok: false, porque: 'leitura incoerente: pode desligar com pendências' }
  if (!r.pode && faltam.length === 0) return { ok: false, porque: 'leitura incoerente: não pode desligar e nenhuma pendência' }
  return { ok: true, pode: r.pode, faltam }
}

function linha(f: FaltaPodeDesligar): string {
  const onde = [f.classe, f.tabela, f.mes].filter((v): v is string => v !== null).join(' ')
  const extra = f.detalhe === null ? '' : ` (${f.detalhe})`
  switch (f.motivo) {
    case 'automatico_armado': return `- o automático está armado: desarme na página do Arquivo (clique) e rode de novo${extra}`
    case 'mes_nao_recebido': return `- ${onde}: selado e ainda não recebido no NAS; espere o copiador das 03:17 ou das 15:17 e rode de novo${extra}`
    case 'b2_vencido_mes_fora': return `- ${onde}: fora do banco, com a conferência do B2 de mais de 7 dias; rode ${COMANDO_CONFERIR_B2_COMPLETO} e rode de novo${extra}`
  }
}

export function frasesPodeDesligar(l: LeituraPodeDesligar): { codigo: 0 | 1; saida: string[] } {
  if (!l.ok) return { codigo: 1, saida: [`não consegui ler o estado do arquivo: ${l.porque}`, 'NÃO DESLIGUE: sem leitura não há "pode desligar"'] }
  if (l.pode) return { codigo: 0, saida: ['nada pendente: tudo recebido no NAS, automático desarmado, conferências do B2 em dia', 'PODE DESLIGAR'] }
  return { codigo: 1, saida: [...l.faltam.map(linha), `NÃO DESLIGUE AINDA (${l.faltam.length} pendência${l.faltam.length === 1 ? '' : 's'})`] }
}
```

- [ ] **Step 4: Ligar o subcomando em `cli.ts`** (seis edições exatas)

1. No comentário do topo, a lista de subcomandos ganha `pode-desligar`: `(pausar, despausar, exportar, conferir, comandos-nas, confirmar-nas, remover, comandos-recarga, estado, pode-desligar)`.
2. Depois de `import { sinalDoBanco, type LinhaBruta } from './sinal-do-banco'`:

```ts
import { frasesPodeDesligar, lerPodeDesligar } from './pode-desligar'
```

3. Na união `Comando`, depois de `| { nome: 'comandos-recarga'; lote: string; pasta: string }`:

```ts
  | { nome: 'pode-desligar'; site: string | null }
```

4. Em `USO`, antes da linha `'ambiente: OBS_ARQUIVO_DB_URL ...'`:

```ts
  '  pode-desligar    [--site <uuid>]                                                  (só lê; antes de desligar a casa)',
```

5. `COM_BANCO` ganha `'pode-desligar'`; `OPCOES` ganha `'pode-desligar': { valor: ['site'], bandeira: [], obrigatorias: [] },`; e no `switch (sub)` de `interpretar`, antes do `default`:

```ts
    case 'pode-desligar': return { nome: 'pode-desligar', site }
```

6. No `switch (c.nome)` de `rodar`, depois de `case 'remover': ...`:

```ts
      case 'pode-desligar': return await podeDesligar(sql, s.site)
```

e, depois de `rodar`, a função:

```ts
/** Só lê (02 §10.10; contrato C11): transação somente leitura, a função, rollback. Erro do banco cai no catch de `rodar`
 *  (frase do catálogo, nunca a mensagem do banco) e nunca vira "pode desligar". */
async function podeDesligar(sql: ClienteSql, site: string): Promise<Saida> {
  await sql.query('begin transaction read only')
  try {
    const r = await sql.query('select public.obs_archive_pode_desligar($1) as r', [site])
    return frasesPodeDesligar(lerPodeDesligar(r.rows[0]?.r))
  } finally {
    await sql.query('rollback')
  }
}
```

- [ ] **Step 5: Rodar e ver passar (com o teste da E10 junto)**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-pode-desligar.test.ts test/youtube/observatorio/arquivo-cli.test.ts > /tmp/m3b-pd.txt 2>&1; grep -E "Test Files|Tests|FAIL" /tmp/m3b-pd.txt`
Expected: `Test Files  2 passed`, nenhum `FAIL`.
Run: `npm run typecheck -w apps/web > /tmp/m3b-tc.txt 2>&1; tail -3 /tmp/m3b-tc.txt`
Expected: sem erro.

- [ ] **Step 6: Commit no site**

```bash
git add -- apps/web/src/lib/youtube/observatorio/arquivo/pode-desligar.ts apps/web/test/youtube/observatorio/arquivo-pode-desligar.test.ts
git commit -m "feat: obs-arquivo pode-desligar, só leitura, nunca 'pode' sem a leitura do contrato (manutenção M3b, item 149)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo/pode-desligar.ts apps/web/test/youtube/observatorio/arquivo-pode-desligar.test.ts apps/web/src/lib/youtube/observatorio/arquivo/cli.ts
```

---

### Task 8: os arquivos de comandos do dono

**Files (fora do git, em `.superpowers/sdd/manutencao-nas/m3b/`):** os quinze da tabela "Arquivos de comandos do dono". Nenhum comando para colar além das exceções do `05` §16 (a linha do cron e as URLs do healthchecks.io): desligar a forja e o scrub são arquivos (K6), e a conexão do banco é pedida sem eco.

**Interfaces:**
- Consumes: o kit commitado (Tarefas 1 a 6, e `pulso_arquivo.py` da M3a); `scripts/obs-arquivo.ts pode-desligar` (Tarefa 7).
- Produces: uma linha curta por arquivo, com a saída em `saidas/m3b-*-<data>.txt`, e a linha "saída boa" de cada um (P39).

- [ ] **Step 1: Escrever os arquivos**

`m3b-forja-0-antes.sh`:

```bash
#!/bin/bash
# M3b, forja, bloco 0: o que há antes de instalar. SÓ LEITURA. Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-0-antes.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-forja-0-$(date +%Y-%m-%d-%H%M).txt
f() { echo "### $1"; ssh forja "$2" 2>&1; echo; }
{
f crontab "crontab -l | sed -E 's#hc-ping.com/[0-9a-f-]+#hc-ping.com/X#g'"
f crontab-md5 "crontab -l | md5sum"
f pulso-md5 "md5sum /opt/agente/docs/pulso.sh"
f pulso-ancora "grep -c '\[ \"\$ok\" -eq 1 \]' /opt/agente/docs/pulso.sh"
f pulso-blocos-arquivo "grep -c '>>> arquivo_' /opt/agente/docs/pulso.sh"
f opt-arquivo "ls -la /opt/arquivo /opt/arquivo/chaves /opt/arquivo/estado /opt/arquivo/ferramentas"
f chaves "stat -c '%a %n' /opt/arquivo/chaves/copiador.chave /opt/arquivo/chaves/conferidor.chave"
f montagens "findmnt -t nfs4 -o TARGET,SOURCE,OPTIONS | grep /mnt/arquivo"
f sentinelas "ls -la /mnt/arquivo/escrita/numerico/.arquivo-vivo /mnt/arquivo/escrita/texto/.arquivo-vivo"
f rclone "command -v rclone; ls -la /usr/local/bin/rclone /usr/bin/rclone 2>&1; /usr/local/bin/rclone version 2>/dev/null | head -1; rclone listremotes"
f python "/usr/bin/python3 -c 'import sys; print(sys.version.split()[0], sys.version_info[:2] == (3, 12))'"
f relogio "timedatectl show -p NTPSynchronized --value; date -Iseconds"
} >"$OUT"
echo "saída em $OUT"
```

`m3b-forja-1-instalar.sh`:

```bash
#!/bin/bash
# M3b, forja, bloco 1: instala o copiador, o conferir-b2 e as ferramentas. ESCRITA na forja (do dono). Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-1-instalar.sh
# Sem sudo: /opt/arquivo é do thiago desde a M3a. Nunca rsync --delete nem rm -r em /opt/arquivo (guarda as chaves).
set -euo pipefail
K=~/Workspace/forja/ferramentas
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-forja-1-$(date +%Y-%m-%d-%H%M).txt
exec > >(tee "$OUT") 2>&1
[ -z "$(git -C $K status --porcelain -- arquivo)" ] || { echo "PARE: o kit tem mudança sem commit em arquivo/"; exit 1; }
bash $K/arquivo/teste_tudo.sh || { echo "PARE: teste do kit falhando"; exit 1; }
V=$(git -C $K rev-parse --short HEAD)
ssh forja 'test -f /opt/arquivo/chaves/copiador.chave && test -f /opt/arquivo/chaves/conferidor.chave' || { echo "PARE: a M3a não terminou (chaves)"; exit 1; }
ssh forja 'mkdir -p /opt/arquivo/copiador /opt/arquivo/conferir-b2 /opt/arquivo/ferramentas'
scp $K/arquivo/comum.py $K/arquivo/cliente_site.py $K/arquivo/b2.py $K/arquivo/restaurar_do_b2.py forja:/opt/arquivo/
scp $K/arquivo/copiador/copiar.py forja:/opt/arquivo/copiador/
scp $K/arquivo/conferir-b2/conferir.py forja:/opt/arquivo/conferir-b2/
scp $K/arquivo/relogio_forja.sh forja:/opt/arquivo/ferramentas/
scp $K/arquivo/teste_comum.py forja:/opt/arquivo/
scp $K/arquivo/copiador.env.modelo $K/arquivo/conferir-b2.env.modelo forja:/opt/arquivo/
ssh forja 'cp -n /opt/arquivo/copiador.env.modelo /opt/arquivo/copiador.env'
ssh forja 'cp -n /opt/arquivo/conferir-b2.env.modelo /opt/arquivo/conferir-b2.env'
ssh forja 'chmod 600 /opt/arquivo/copiador.env /opt/arquivo/conferir-b2.env'
ssh forja "echo $V > /opt/arquivo/VERSAO"
echo "--- conferência (md5 do kit contra a forja)"
(cd $K/arquivo && md5 -r comum.py cliente_site.py b2.py restaurar_do_b2.py copiador/copiar.py conferir-b2/conferir.py \
  teste_comum.py copiador.env.modelo conferir-b2.env.modelo | sed 's/ /  /') | ssh forja 'cd /opt/arquivo && md5sum -c --quiet' \
  && (cd $K/arquivo && md5 -r relogio_forja.sh | sed 's/ /  /') | ssh forja 'cd /opt/arquivo/ferramentas && md5sum -c --quiet' \
  && echo "KIT-IGUAL $V"
```

`m3b-forja-2-ligar-e-provar.sh`:

```bash
#!/bin/bash
# M3b, forja, bloco 2: o teste do leitor no Python da forja, liga o conferir-b2 e roda as duas provas.
# Uma escrita (a variável OBS_ARQUIVO_CONFERIR_B2 no .env da forja); o resto só lê. Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-2-ligar-e-provar.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-forja-2-$(date +%Y-%m-%d-%H%M).txt
{
echo "### leitor no python da forja (item 20)"
ssh forja 'cd /opt/arquivo && /usr/bin/python3 -B teste_comum.py | tail -1'
echo "### ligar o conferir-b2"
ssh forja "sed -i 's/^OBS_ARQUIVO_CONFERIR_B2=.*/OBS_ARQUIVO_CONFERIR_B2=on/' /opt/arquivo/conferir-b2.env"
ssh forja 'grep ^OBS_ARQUIVO_CONFERIR_B2 /opt/arquivo/conferir-b2.env'
echo "### rclone (o cron tem PATH=/usr/bin:/bin; o programa escolhe pelo caminho: Yannis I7)"
ssh forja 'command -v rclone; cd /opt/arquivo && /usr/bin/python3 -B -c "import b2; print(\"RCLONE-DO-PROGRAMA:\", b2.rclone_padrao())"'
echo "### prova do copiador (lê; o site registra a consulta em last_poll_at)"
ssh forja 'flock -n /opt/arquivo/copiador.lock /usr/bin/python3 -B /opt/arquivo/copiador/copiar.py --prova'
echo "### prova do conferir-b2"
ssh forja 'flock -n /opt/arquivo/conferir-b2.lock /usr/bin/python3 -B /opt/arquivo/conferir-b2/conferir.py --prova'
} >"$OUT" 2>&1
echo "saída em $OUT"
```

`m3b-forja-3-cron.md`:

````markdown
# M3b, forja, bloco 3: as duas linhas do cron (a exceção do 05 §16: crontab -e)

Na forja: `ssh -t forja 'crontab -e'`, **acrescente** as duas linhas no fim (nunca `crontab -` com arquivo inteiro), salve e saia.

```
17 3,15 * * * flock -n /opt/arquivo/copiador.lock timeout -k 30s 40m /usr/bin/python3 -B /opt/arquivo/copiador/copiar.py --cron >>/opt/arquivo/log/copiador.err 2>&1
7 11 * * * flock -n /opt/arquivo/conferir-b2.lock timeout -k 30s 40m nice -n 19 ionice -c3 /usr/bin/python3 -B /opt/arquivo/conferir-b2/conferir.py --cron >>/opt/arquivo/log/conferir-b2.err 2>&1
```

Depois, para conferir (leitura): `ssh forja 'crontab -l | grep -c /opt/arquivo/'` deve dizer `2`.
````

`m3b-forja-4-registros.sh`:

```bash
#!/bin/bash
# M3b, forja, bloco 4: no dia seguinte ao cron, os registros dos dois programas. SÓ LEITURA. Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-4-registros.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-forja-4-$(date +%Y-%m-%d-%H%M).txt
f() { echo "### $1"; ssh forja "$2" 2>&1; echo; }
{
f copiador-cron "grep '\"modo\": \"cron\"' /opt/arquivo/log/copiador.jsonl | tail -3"
f conferir-b2-cron "grep '\"modo\": \"cron\"' /opt/arquivo/log/conferir-b2.jsonl | tail -3"
f err "tail -5 /opt/arquivo/log/copiador.err /opt/arquivo/log/conferir-b2.err 2>&1"
f plano-em-disco "cat /opt/arquivo/estado/plano.json; echo; stat -c '%y' /opt/arquivo/estado/plano.json"
f canarios "ls -la /mnt/arquivo/escrita/numerico/_canario /mnt/arquivo/escrita/texto/_canario"
f recebendo "find /mnt/arquivo/escrita/*/_recebendo -type f | wc -l; find /mnt/arquivo/escrita/*/_recebendo -type f | head -20"
f bytes-b2 "cat /opt/arquivo/estado/conferir-b2-bytes.json"
} >"$OUT"
echo "saída em $OUT"
```

`m3b-forja-5-pulso.sh`:

```bash
#!/bin/bash
# M3b, forja, bloco 5: instala os três blocos do pulso (M3a, Tarefa 6). ESCRITA na forja (do dono). Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-5-pulso.sh
# As três URLs vêm do cofre e são digitadas aqui (nunca vão para arquivo nem para a saída).
set -euo pipefail
K=~/Workspace/forja/ferramentas
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-forja-5-$(date +%Y-%m-%d-%H%M).txt
read -r -p "URL de 'Arquivo: copiador': " U1
read -r -p "URL de 'Arquivo: conferência do B2': " U2
read -r -p "URL de 'Arquivo: pulso': " U3
exec > >(sed -E 's#hc-ping.com/[0-9a-f-]+#hc-ping.com/X#g' | tee "$OUT") 2>&1
[ -z "$(git -C $K status --porcelain -- arquivo/pulso_arquivo.py arquivo/teste_pulso_arquivo.py)" ] || { echo "PARE: pulso_arquivo com mudança sem commit"; exit 1; }
scp $K/arquivo/pulso_arquivo.py $K/arquivo/teste_pulso_arquivo.py forja:/opt/agente/docs/
ssh forja 'cd /opt/agente/docs && cp -n pulso.sh pulso.sh.antes-m3b'
printf '%s\n' "$U1" "$U2" "$U3" | ssh forja 'cd /opt/agente/docs && python3 pulso_arquivo.py --stdin'   # fora do argv (m2)
ssh forja 'cd /opt/agente/docs && bash -n pulso.sh.tmp'
ssh forja 'cd /opt/agente/docs && python3 teste_pulso_arquivo.py pulso.sh.tmp | tail -1'
ssh forja 'cd /opt/agente/docs && chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh'
ssh forja 'grep -c ">>> arquivo_" /opt/agente/docs/pulso.sh'
echo "PULSO-INSTALADO"
```

`m3b-forja-6-conferencia.sh`:

```bash
#!/bin/bash
# M3b, forja, bloco 6: conferência final, uma hora depois do bloco 5. SÓ LEITURA. Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-6-conferencia.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-forja-6-$(date +%Y-%m-%d-%H%M).txt
ANTES=$(ls -t $S/m3b-forja-0-*.txt 2>/dev/null | head -1)
f() { echo "### $1"; ssh forja "$2" 2>&1; echo; }
{
f crontab "crontab -l | sed -E 's#hc-ping.com/[0-9a-f-]+#hc-ping.com/X#g'"
echo "### ITEM33-fila (a linha da fila e o timeout não mudaram)"
ssh forja 'crontab -l | grep -c "^\*/10 \* \* \* \* AGENTE_SITIO=/opt/agente/docs/sitio.py timeout -k 30s 25m /opt/agente/venv/bin/python -B /opt/agente/docs/trilha/fila_intel.py --cron"'
echo "### ITEM33-pulso (fora dos blocos do arquivo, o pulso é o de antes, byte a byte; a conta é feita no Mac)"
T=$(mktemp -d)
ssh forja 'cat /opt/agente/docs/pulso.sh' >"$T/pulso.sh"
ssh forja 'cat /opt/agente/docs/pulso.sh.antes-m3b' >"$T/antes"
(cd "$T" && python3 ~/Workspace/forja/ferramentas/arquivo/pulso_arquivo.py --remover >/dev/null && cmp pulso.sh.tmp antes && echo PULSO-FORA-DOS-BLOCOS-IGUAL)
rm -rf "$T"
f pulso-ultima-execucao "ls -la --time-style=full-iso /opt/agente/docs/pulso.sh; grep -h 'pulso' /var/log/syslog 2>/dev/null | tail -2"
f copiador-cron "grep '\"modo\": \"cron\"' /opt/arquivo/log/copiador.jsonl | tail -2"
f conferir-b2-cron "grep '\"modo\": \"cron\"' /opt/arquivo/log/conferir-b2.jsonl | tail -2"
echo "### bloco 0 desta etapa: $ANTES"
} >"$OUT"
echo "saída em $OUT"
```

`m3b-relogio.sh`:

```bash
#!/bin/bash
# M3b: o relógio da forja (05 §16.11 passo 5; âmbar "relógio da forja" a qualquer tempo). ESCRITA só se o NTP
# estiver desligado (sudo timedatectl set-ntp true). Uso (Mac; o sudo pede a senha da forja, digitada aqui):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-relogio.sh
# Saída boa: "RELOGIO: SINCRONIZADO" e "DIFERENCA-MAC-FORJA-S: " com valor absoluto até 2.
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-relogio-$(date +%Y-%m-%d-%H%M).txt
ssh -t forja 'bash /opt/arquivo/ferramentas/relogio_forja.sh' | tee "$OUT"
m=$(date -u +%s); f=$(ssh forja 'date -u +%s')
echo "DIFERENCA-MAC-FORJA-S: $((f - m))" | tee -a "$OUT"
```

`m3b-casa-antes-de-desligar.sh`:

```bash
#!/bin/bash
# Mudança de casa (05 §16.11, passo 2): o pode-desligar. SÓ LEITURA do banco. Uso (Mac), depois de desarmar o automático:
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-antes-de-desligar.sh
# Pede a conexão direta (com a senha do banco) sem eco: nunca vai para o histórico do shell nem para a saída (K6).
# Saída boa: última linha "PODE DESLIGAR". Com pendência, ele diz qual e o que rodar; repita até "PODE DESLIGAR".
[ -n "${OBS_ARQUIVO_DB_URL:-}" ] || { read -r -s -p "conexão direta (não aparece): " OBS_ARQUIVO_DB_URL; echo; }
export OBS_ARQUIVO_DB_URL
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-pode-desligar-$(date +%Y-%m-%d-%H%M).txt
cd ~/Workspace/bythiagofigueiredo && npx tsx scripts/obs-arquivo.ts pode-desligar 2>&1 | tee "$OUT"
echo "saída em $OUT"
```

`m3b-casa-conferir-b2-completo.sh`:

```bash
#!/bin/bash
# Mudança de casa: a conferência completa do B2, à mão (02 §10.10; P28). Grava só o registro e o contador de bytes da forja.
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-conferir-b2-completo.sh
# Saída boa: "conferir-b2: ok". "teto_bytes" ou "incompleto" com "parcial": true: repita (no dia seguinte, se for o teto):
# continua de onde parou. Quem guarda o ponto é o site (contrato C2 r2.2): a linha mostra "retomado_de" (de onde esta
# execução partiu; null = do zero) e "cobertura" (páginas aceitas sobre o total). O pode-desligar continua listando
# até a cobertura fechar. Um completo aberto há mais de 35 dias acende b2_completo_atrasado no site.
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-conferir-b2-completo-$(date +%Y-%m-%d-%H%M).txt
ssh forja 'flock -n /opt/arquivo/conferir-b2.lock timeout -k 30s 40m nice -n 19 ionice -c3 /usr/bin/python3 -B /opt/arquivo/conferir-b2/conferir.py --completo; tail -1 /opt/arquivo/log/conferir-b2.jsonl' 2>&1 | tee "$OUT"
```

`m3b-casa-desligar-forja.sh`:

```bash
#!/bin/bash
# Mudança de casa (05 §16.11, passo 3): desliga a forja. ESCRITA (do dono; o sudo pede a senha da forja, digitada aqui).
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-desligar-forja.sh
# Antes: o pode-desligar com "PODE DESLIGAR" e o NAS desligado pela tela do TrueNAS. Saída boa: a conexão cai.
ssh -t forja 'sudo systemctl poweroff'
```

`m3b-casa-depois-de-religar.sh`:

```bash
#!/bin/bash
# Mudança de casa (05 §16.11, passos 4 e 5), depois de religar. SÓ LEITURA. Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-depois-de-religar.sh
# Saída boa: as linhas marcadas com "BOA:" abaixo. O relógio, se a última linha não for SINCRONIZADO: m3b-relogio.sh.
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-depois-de-religar-$(date +%Y-%m-%d-%H%M).txt
f() { echo "### $1"; ssh "$2" "$3" 2>&1; echo; }
{
f "pool (BOA: state ONLINE, errors: No known data errors)" nas "zpool status fast | grep -E 'state:|errors:'"
f "chave (BOA: available nas três linhas)" nas "zfs get -H -o name,value keystatus fast/appdata fast/appdata/site-arquivo/numerico fast/appdata/site-arquivo/texto"
f "montagens (BOA: quatro linhas nfs4)" forja "findmnt -t nfs4 -o TARGET,SOURCE | grep -c /mnt/arquivo"
f "sentinelas (BOA: dois arquivos listados)" forja "ls /mnt/arquivo/escrita/numerico/.arquivo-vivo /mnt/arquivo/escrita/texto/.arquivo-vivo"
f "relógio (BOA: yes)" forja "timedatectl show -p NTPSynchronized --value"
f "último copiador (BOA: desfecho ok; modo_plano completo nas execuções depois da volta)" forja "tail -2 /opt/arquivo/log/copiador.jsonl"
} >"$OUT"
echo "saída em $OUT"
echo "O scrub (escrita no NAS), quando quiser: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-scrub.sh"
```

`m3b-casa-scrub.sh`:

```bash
#!/bin/bash
# Mudança de casa (05 §16.11, passo 4), depois de religar: o scrub do pool. ESCRITA no NAS (do dono; o sudo pede a senha).
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-casa-scrub.sh
# Saída boa: "scan: scrub in progress" agora; depois de terminar, m3b-casa-depois-de-religar.sh mostra "No known data errors".
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-scrub-$(date +%Y-%m-%d-%H%M).txt
ssh -t nas 'sudo zpool scrub fast; zpool status fast | grep -E "scan:|state:"' 2>&1 | tee "$OUT"
```

`m3b-restaurar.sh`:

```bash
#!/bin/bash
# M3b: restaurar do B2, pelo fileId da última conferência boa, o que o site marcou como "aguardando arquivo do dono" (P24).
# ESCRITA no NAS (em _recebendo; o copiador confere e move). Uso (Mac):
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-restaurar.sh            (pára se o final existir)
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-restaurar.sh --quarentena
# Saída boa: uma linha RESTAURADO (ou JA-EM-RECEBENDO) por arquivo. SEM-VERSAO-BOA-NO-B2: decisão do dono (declarar-perdida).
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas
OUT=$S/m3b-restaurar-$(date +%Y-%m-%d-%H%M).txt
# Sob a trava do copiador (M4 do Phil, Yannis I9): nunca escreve em _recebendo durante uma execução dele.
ssh forja "flock -n /opt/arquivo/copiador.lock /usr/bin/python3 -B /opt/arquivo/restaurar_do_b2.py --do-plano ${1:-} || echo 'PARE: o copiador está rodando (trava) ou a restauração parou; repita depois'" 2>&1 | tee "$OUT"
```

`m3b-desfazer-forja.sh`:

```bash
#!/bin/bash
# M3b: volta atrás na forja. ESCRITA (do dono). ANTES: tirar as duas linhas do arquivo do crontab, por crontab -e.
#   bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-desfazer-forja.sh
# Não apaga nada do NAS nem /opt/arquivo/chaves; desliga o conferir-b2 e tira os blocos do pulso.
set -euo pipefail
ssh forja 'crontab -l | grep -c "/opt/arquivo/" || true' | grep -qx 0 || { echo "PARE: o crontab ainda tem linhas do arquivo (crontab -e primeiro)"; exit 1; }
ssh forja "sed -i 's/^OBS_ARQUIVO_CONFERIR_B2=.*/OBS_ARQUIVO_CONFERIR_B2=off/' /opt/arquivo/conferir-b2.env"
ssh forja 'cd /opt/agente/docs && python3 pulso_arquivo.py --remover && bash -n pulso.sh.tmp && chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh'
ssh forja 'grep -c ">>> arquivo_" /opt/agente/docs/pulso.sh || true'
echo "DESFEITO (as três verificações do healthchecks.io: pausar no painel, clique)"
```

- [ ] **Step 2: Conferir a sintaxe**

Run: `cd ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b && for f in m3b-*.sh; do bash -n "$f" || echo "ERRO $f"; done; echo FIM`
Expected: só `FIM`.

- [ ] **Step 3: A seção "AGORA" do `LEIAME-COMANDOS.md`**

Trocar a seção "AGORA" de `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` pelos blocos 0 a 2 da Tarefa 9 (uma linha curta cada, com o "por quê"); o que já rodou desce para o histórico (regra do LEIAME). Sem commit: `.superpowers/` não entra no git.

---

### Task 9: a execução pelo dono (só quando o lado do site estiver em produção)

**Pré-condições, todas lidas antes do bloco 0:** M3a fechada no ledger dela (chaves, montagens, `rclone` decifrando, verificações "nova"); a migration da M3b em produção e `OBS_ARQUIVO=on` na Vercel com o deploy feito (`05` §16.5: sem ela o copiador registra `arquivo_desligado`); as rotas do C1 a C8 respondendo (`curl` com a chave do copiador não se faz do Mac: a prova é o `--prova` do bloco 2). Sem qualquer uma: parar.

- [ ] **Bloco 0 (leitura).** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-0-antes.sh`
  **Segue se:** `crontab` com as 4 linhas de hoje (F35) e nenhuma de `/opt/arquivo`; `pulso-ancora` = 1 e `pulso-blocos-arquivo` = 0; as duas chaves em `600`; quatro montagens `nfs4`; as duas sentinelas listadas; `python` = `3.12.3 True`; `rclone` com `/usr/local/bin/rclone` presente (o do plano B da M3a; é o que o programa escolhe no cron); `relogio` = `yes`. **Dado ausente:** sem `/opt/arquivo/chaves`, a M3a não terminou: parar. Linha de `crontab-md5` e `pulso-md5` vão para o ledger (o bloco 6 compara).
- [ ] **Bloco 1 (escrita).** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-1-instalar.sh`
  **Segue se:** onze `PASSOU` (no `python3.12` do Mac; `PARE: falta python3.12` = instalar com `uv python install 3.12`), e a última linha `KIT-IGUAL <rev>` (o md5 cobre programas, `teste_comum.py`, modelos e `relogio_forja.sh`). `PARE: o kit tem mudança sem commit` ou `teste do kit falhando`: voltar à tarefa do kit. Sem `KIT-IGUAL` (md5 diferente ou arquivo faltando na forja): repetir o bloco.
- [ ] **Bloco 2 (uma escrita: liga o `conferir-b2`).** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-2-ligar-e-provar.sh`
  **Segue se:** `comum: 0 falha(s)` (o leitor próprio no Python 3.12.3 da forja, item 20); `RCLONE-DO-PROGRAMA: /usr/local/bin/rclone` (ou `/usr/bin/rclone` se a M3a não precisou do plano B); `OBS_ARQUIVO_CONFERIR_B2=on`; na prova do copiador, `PROVA: numerico montado=True sentinela=True` e o mesmo para `texto`, e `copiador: ok`; na prova do `conferir-b2`, `PROVA: controle_negativo ausente`. **Dado ausente, e é o normal no dia da instalação:** os canários ainda não existem no B2 (o primeiro nasce no copiador das 03:17 ou 15:17 e sobe às 06:10), então `canario:<filho> ausente` e `conferir-b2: controle_falhou` são esperados aqui; `canario:<filho> sem_acesso` não é (é a chave ou a rede: voltar ao bloco 10 da M3a). `copiador: arquivo_desligado`: a variável da Vercel ou o deploy. `copiador: chave`: a chave do copiador na forja (M3a).
- [ ] **Bloco 3 (a exceção: `crontab -e`).** Seguir `m3b-forja-3-cron.md`. **Segue se:** `crontab -l | grep -c /opt/arquivo/` = `2`.
- [ ] **Bloco 4 (leitura, no dia seguinte, depois das 11:47).** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-4-registros.sh`
  **Segue se:** **a última** linha `"modo": "cron"` de cada registro com `"desfecho": "ok"`; no `conferir-b2`, antes de 28/11, `"pedidos": 0` com `"estado": "aguardando_primeira_selagem"` (depois, `pedidos` igual a `informados`, ou `pedidos: 0` com `"estado": "nada_devido"`); `plano.json` com `"vermelhos": []` e `obtido_em` de menos de 13 h; os dois `_canario/` com o arquivo do dia; `_recebendo` com `0` arquivos; `.err` vazios. **Dado ausente:** nenhuma linha de cron = o cron não rodou (`crontab -l`, `flock` preso, relógio). `conferir-b2` com `controle_falhou`: pela conta (canário das 03:17, subida às 06:10, servido 6 horas depois de informado, às 09:17), a execução das 11:07 do primeiro dia já serve; se ainda assim vier `controle_falhou`, esperar o 11:07 do dia seguinte e rodar este bloco de novo; **no segundo dia seguido, parar** e ler `contagens` (`canario_desconhecido`, `canario_ausente`, `canario_nao_decifra`) e o `canario_ok` da linha. Não seguir para o bloco 5 com `controle_falhou` (I4 do Phil: o primeiro aviso ao celular seria falso).
- [ ] **Bloco 5 (escrita), antes de 28/11 (D-F15).** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-5-pulso.sh` (as três URLs do cofre, digitadas na hora; vão à forja pela entrada, nunca no `argv`)
  **Segue se:** `pulso arquivo: 0 falha(s)` (o teste da M3a sobre o `pulso.sh.tmp`, que confere também que os blocos instalados são os do kit), `3` e `PULSO-INSTALADO`. Qualquer `PARE`: nada foi trocado (o `mv` é o último passo).
- [ ] **Bloco 6 (leitura, uma hora depois do bloco 5).** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-forja-6-conferencia.sh`, e **(clique)** o painel do healthchecks.io.
  **Segue se:** `ITEM33-fila` = `1` (a linha da fila, com `timeout -k 30s 25m`, não mudou) e `PULSO-FORA-DOS-BLOCOS-IGUAL` (item 33); o crontab com 6 linhas (as 4 de antes e as 2 do arquivo); no painel, **as três verificações "Arquivo: ..." saíram de "nova" e estão "up"** (interface da M3a: verificação que nunca recebeu sinal não avisa nada). Uma delas "down": ler o `motivo` no registro do pulso (`/opt/agente/log`) e o desfecho do programa dela.
- [ ] **Relógio, quando a página mostrar o âmbar "relógio da forja" (e no passo 5 da mudança de casa).** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3b/m3b-relogio.sh` — **saída boa:** `RELOGIO: SINCRONIZADO` e `DIFERENCA-MAC-FORJA-S:` entre `-2` e `2`.
- [ ] **Fecho:** registrar no ledger da M3b (`.superpowers/sdd/manutencao-nas/m3b-progresso.md`) a data e a saída de cada bloco, o `KIT-IGUAL <rev>`, e marcar no índice dos planos a linha 5b **só com `PULSO-INSTALADO` e o bloco 6 com as três verificações "up"** (D-F15).
- [ ] **Conferências com data (vão ao ledger quando acontecerem):** (a) primeira execução de cron com unidade em partes (provável em 28/11, na horária): a última linha de cron do `copiador.jsonl` sem `unidade_falhou` em `contagens` e com `desfecho: ok`, e no banco `select count(*) from obs_archive_unit_parts where received_at is null and exported_at < now() - interval '2 hours';` = `0`; (b) de 30/11 a 03/12, a última linha do `conferir-b2.jsonl` todo dia com `desfecho: ok` e `pedidos >= 1` ou `estado: nada_devido`; (c) primeira volta de casa fora (ou ensaio): `select motivo, due_since, nas_back_at, started_at, finished_at from obs_archive_sweeps order by due_since desc limit 1;` com `due_since` anterior ao desligamento e `finished_at` preenchido depois de 1 ou 2 execuções (linha ausente = o defeito C2 voltou).

### A mudança de casa (`05` §16.11), com os arquivos desta etapa

Não tem data e não é tarefa de implementação: são os arquivos acima, na ordem do roteiro, para quando o dono quiser.

| Passo do `05` §16.11 | Arquivo | Saída boa |
|---|---|---|
| 1. Desarmar o automático | **(clique)** página do Arquivo | n/a |
| 2. `pode-desligar` | `bash …/m3b/m3b-casa-antes-de-desligar.sh` (pede a conexão direta sem eco) | última linha `PODE DESLIGAR`. Com `b2_vencido_mes_fora`: `bash …/m3b/m3b-casa-conferir-b2-completo.sh` (saída boa `conferir-b2: ok`; `teto_bytes` ou `incompleto` = repetir, no dia seguinte se for o teto: continua de onde parou, pelo `retomado_de` e a `cobertura` do site, r2.2) e rodar o passo 2 de novo. Anotar a hora da última conferência do B2 no ledger (item 150) |
| 3. Desligar | tela do TrueNAS; `bash …/m3b/m3b-casa-desligar-forja.sh` | a conexão cai |
| 4. e 5. Depois de religar | `bash …/m3b/m3b-casa-depois-de-religar.sh`; o relógio, se não for `yes`: `m3b-relogio.sh`; o scrub: `bash …/m3b/m3b-casa-scrub.sh` | as linhas `BOA:` do próprio arquivo; `scrub in progress` |
| 6. Varredura completa | nenhuma linha: o copiador a faz sozinho. O site abre a varredura no primeiro batimento bom do copiador depois de mais de 24 h sem outro (C8 r2), e também no `GET plan` (C1); o copiador pede o plano antes de mandar o batimento (D-F18) | `"modo_plano": "completo"` nas linhas de cron depois da volta, até a página do Arquivo mostrar a hora em que terminou. Arquivo diferente ou ausente num mês fora do banco aparece em `aguardando_dono`: `bash …/m3b/m3b-restaurar.sh` (saída boa: `RESTAURADO`) |
| 7. e 8. | **(clique)** Run Now da tarefa do NAS; armar de novo | n/a |

---

## Itens de aceite que esta etapa fecha, e onde

| Item | Onde fecha |
|---|---|
| 20 (leitor Python: nulo, `""` e `0`) | Tarefa 1 (leitor próprio, `linhas_csv_gz`), provado no Python 3.12 do Mac pelo `teste_tudo.sh` (K1) e no 3.12.3 da forja no bloco 2 |
| 27 (copiador: `nas_fora` sem marcar nem gravar em disco local; parcial em `_recebendo`; final com outro hash não é sobrescrito; disco cheio `nas_cheio`) | Tarefa 3, casos 2, 3 e 11 (com o NAS cheio, o que já está no final continua sendo informado) |
| 30 (batimento só em `obs_archive_heartbeat`; registro e verificação próprios) | Tarefa 3, caso 1 (rota `heartbeat` do arquivo); bloco 6 (verificação própria "up") |
| 33 (a fila não mudou) | Bloco 6 (`ITEM33-fila`, `PULSO-FORA-DOS-BLOCOS-IGUAL`) |
| 74 (alarme aos 80% do filho em que se grava) | Parte do kit: Tarefa 1 (`alerta_80`, `corpo_batimento` com `total_bytes`) e Tarefa 3, caso 11 (o batimento leva livre e total; a linha marca `alerta_80`). O vermelho `nas_80:<filho>` é do site (D-F13, X4) |
| 76 (o copiador envia hash, contagem e soma em `unit/received` e em `attest`) | Tarefa 3, casos 1, 4 (soma relida de cada parte) e 7 |
| 79 (cada variável com padrão tem teste que a apaga) | Tarefas 1 (`config`, `ambiente`), 3 (caso 13), 4 (caso 9) |
| 131, parte do caminho (a classe no primeiro nível; duas classes, dois nomes) | Tarefa 1 |
| 132, parte do kit | Tarefa 4: `repetir` baixa de novo uma vez; não decifra: `nao_decifra` (o site retira); controle negativo presente: `controle_falhou`; controle sem acesso: `sem_acesso`; recusa remoto que não é B2 (o teste "apontado para a montagem do NAS"); variável apagada não roda; canário adulterado: `controle_falhou` sem retirar; execução cortada deixa os informados e não vira `controle_falhou`; sem configuração da cifra: `chave_ausente` |
| 134, parte do kit e instalação | Canário gravado e procurado nos dois filhos (Tarefas 3 e 4); blocos do pulso instalados (bloco 5) e as três verificações fora de "nova" (bloco 6) |
| 149, parte do comando | Tarefa 7 (as contas de 7 dias são da função SQL, do plano do site) |
| 150 (registro na mudança real) | Tabela "A mudança de casa": a saída do `pode-desligar` e a do copiador depois da volta vão ao ledger, com data, quando acontecer |
| 172, parte da forja | Tarefa 3, caso 10 (o copiador pede o plano antes do batimento, e a casa que volta depois de 3 dias recebe `modo_plano: completo`; segue as páginas do site e relê todas; orçamento cortado continua na seguinte); Tarefa 5 ("duas versões no B2 falso, a anterior com o `fileId` atestado: a restauração traz a anterior") |

## O que fica NÃO VERIFICADO depois do plano (e quem prova)

- **O TypeScript da Tarefa 7 não foi rodado** pelo redator; o Python e os `.sh`, sim (no Mac, Python 3.12.13 e 3.14). Prova: os Steps 2 e 5 da Tarefa 7.
- **O leitor próprio no Python 3.12.3 da forja:** provado no 3.12.13 do Mac; o 3.12.3 da forja roda o mesmo `teste_comum.py` no bloco 2 (`comum: 0 falha(s)`).
- **A API `b2api/v4`** foi conferida na documentação oficial em 14/10 (nomes, forma da autorização, `action: start`, cabeçalhos do download). Falta provar com a chave real: a `--prova` do `conferir-b2` no bloco 2 (`controle_negativo ausente`) e a primeira execução de cron com canário (`canario_presente` em `contagens`).
- **A chave de leitura da forja tem `listFiles` e `readFiles`** e está restrita ao bucket (M3a). Prova: idem; bucket do `arq:` fora de `allowed.buckets` é `ErroB2`.
- **O `rclone crypt` sobre uma pasta local, montado por variáveis `RCLONE_CONFIG_ARQLOCAL_*`, decifra o arquivo que o TrueNAS gravou** (a M3a prova o `arq:` sobre o B2, não o remoto local). Prova: o canário decifrado na primeira execução de cron. **Plano B, se não decifrar:** trocar em `b2.decifrar` o remoto local por `rclone cat arq:<filho>/<rel>` (o remoto da M3a); perde-se a amarração do sha256 ao `fileId` (a cópia agendada pode subir uma versão entre a listagem e o download), e isso volta a Phil e Yannis.
- **O sufixo `.bin`** no nome do objeto (D-F3): o bloco 10 da M3a registra o nome cru; outro sufixo se troca em `ARQ_B2_SUFIXO`.
- **A forma do `fileId`** (`^4_z[0-9a-f]{24}_f[0-9a-f]{3}_[0-9a-z_]+$`) vem do contrato, que também a marca NÃO VERIFICADA; o `b2.py` recusa `fileId` fora dela como `ErroB2`. Prova: a primeira execução com arquivo.
- **`statvfs` sobre NFS de um dataset ZFS com `refquota`:** se `f_blocks` reflete a quota do filho ou o pool, o denominador dos 80% muda (Phil, seção 8). Prova: o `total_bytes` do primeiro batimento comparado com `zfs get refquota` no NAS (bloco 4 da M3a ou leitura do dono).
- **O healthchecks.io deixa "nova" sem alerta** (M3a, bloco 2): é por isso que os blocos entram depois do primeiro cron (D-F15).
- **`ssh nas` com permissão para `zpool status` e `zfs get`** (o usuário do NAS: M3a, bloco 0).

## Dependências

- **De outra etapa:** M3a fechada (chaves, montagens, `rclone`, `pulso_arquivo.py` e as verificações "nova"); o lado do site da M3b **em produção**, com `OBS_ARQUIVO=on` e deploy (as sete rotas no contrato r2.2, `obs_archive_pode_desligar`, o plano do B2 com canário de 6 horas, `estado` por filho e a retomada do `--completo` entre execuções, a cor do teto no batimento, a abertura da varredura no `heartbeat`). A Tarefa 7 espera a função existir na migration do site. **As Tarefas 1 a 6 (kit) e 8 (arquivos) não esperam ninguém:** são testadas contra o site falso, que segue o contrato r2.2. A Tarefa 6 altera dois arquivos da M3a (`pulso_arquivo.py` e o teste dele): faça-a depois de a M3a commitar os dela.
- **De outra trilha:** `cli.ts` é da E10 (Tarefa 7 confere o último commit dele antes de editar).
- **Relógio real:** a primeira selagem, devida em 28/11, é a primeira execução com arquivo de verdade; até lá o `conferir-b2` registra `pedidos: 0` com `estado: "aguardando_primeira_selagem"` (vindo do site).
- **O que a M3b-forja deixa para depois:** anexos de miniatura (`a:<uuid>`, classe `video_antigo`) entram na M10b/M10c: hoje o copiador e o `conferir-b2` recusam o item `anexo` como `plano_invalido` (vermelho), de propósito, para o kit ser atualizado junto; prefixos ausentes (`prefixos_ausentes` não vazio é `plano_invalido`) e `expurgar --canal` são da M9; o respondedor, da M7.

## Pedidos ao contrato

Os onze pedidos da versão anterior e os dois novos das revisões (12: abrir a varredura no `heartbeat`; 13: soma da parte) estão **atendidos pelo contrato r2.1** e o kit foi alinhado a ele: 1 (`nao_decifra`, C7.2), 2 (origem da ausência, com `start`), 3 (`teto_bytes_mes` e `parado_no_teto`), 4 (`estado` por filho com `nada_devido`, K4), 5 (`total_bytes` e `nas_80:<filho>`, X4), 6 (silêncio só do copiador, C8), 7 (mesmo `execucao_id` nas páginas, 500 por página, 200 por `attest`; validade por página, X1), 8 (dois canários, caminho nulo), 9 (`_recebendo` é `ausente` na reconferência, X2), 10 (controle negativo presente sem sha256), 11 (C9 com os desfechos do kit; `nas_quase_cheio` fora, X4), 12 (C8, abertura no batimento), 13 (C3, soma vazia em toda parte, linhas e soma relidas da parte). O destino de cada um está em `.superpowers/sdd/manutencao-nas/resolucao-plano-m3b-forja.md`.

### Pedidos ao contrato (r2): fechados na r2.2

Os dois pedidos que a r2.1 deixou em aberto foram decididos pelo controlador em 14/10 e entraram no contrato **r2.2** (C2, C8 e C9). O kit foi alinhado e os seis testes rodaram de novo no Python 3.12. A r2.3 (14/10) acrescenta, só no site, o vermelho `b2_atrasado` (N2 do Phil); o kit não o conhece nem o conta.13 (`0 falha(s)` em cada). Destino de cada um: `.superpowers/sdd/manutencao-nas/resolucao-plano-m3b-forja.md`, seção "Rodada 2.2".

1. **C2, retomada do `--completo` do B2 entre execuções (I3 do Phil): aceito, do lado do site.** O site guarda em `obs_archive_b2_runs` o cursor da última página aceita de cada `--completo` que não terminou; o `GET plan?fonte=b2&completo=1` seguinte retoma dali, num `execucao_id` novo, até cobrir tudo, e só então recomeça do zero. A resposta traz `retomado_de` (cursor ou `null`) e `cobertura` (`{paginas_aceitas, paginas_total}`; `null` no modo normal). Completo aberto há mais de 35 dias: `b2_completo_atrasado` em `vermelhos`. **No kit (cliente e teste):** a forja continua pedindo sem cursor; `validar_plano` exige os dois campos (`cobertura_valida`: no normal, os dois nulos; no completo, cobertura com `0 <= aceitas <= total` e `total >= 1`; o contrário é `plano_invalido`, nada informado); a linha do registro guarda `retomado_de` e a última `cobertura` vista nas páginas; o `m3b-casa-conferir-b2-completo.sh` passa a dizer "repita: continua de onde parou". Testes: `teste_conferir_b2.py`, seção 8 (a execução seguinte pede sem cursor e a linha traz `retomado_de` e a cobertura da última página; seis planos fora da forma são `plano_invalido`).
2. **C8 e C9, `teto_bytes` no pulso (M6 do Phil): âmbar no primeiro dia, vermelho no segundo dia seguido, contados pelo site.** O batimento do `conferir_b2` marca a execução que acabou de rodar (com `parado_no_teto`), e a resposta do batimento traz `teto: 'verde' | 'ambar' | 'vermelho'`, calculado pelo histórico das execuções; o vermelho também entra em `vermelhos` como `b2_teto_2_dias`. **No kit:** `batimento` devolve a cor e a linha a guarda em `teto_cor` (cor fora da lista ou batimento que falha: `null`); o bloco do B2 no pulso fica verde com `teto_bytes` só quando `teto_cor` é `ambar` e mostra `arquivo-b2-teto_bytes-2-dias` (vermelho) ou `arquivo-b2-teto_bytes-sem-cor`. Teste de fronteira em `teste_pulso_arquivo.py`: dia 1 âmbar (verde, sem alerta), dia 2 vermelho, dia 3 sem estouro verde; e em `teste_conferir_b2.py`, seção 7, a cor do site copiada sem contar nada.
