# Fase de manutenção (NAS e forja), M3a: a casa. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deixar a casa pronta para o arquivo durável: bucket e chaves no B2, dataset `fast/appdata/site-arquivo` com os dois filhos no NAS, tarefa `COPY` cifrada, quatro montagens e as ferramentas na forja, `rclone` decifrando o B2 a partir do cofre, três chaves de API registradas e os blocos do `pulso.sh` escritos e testados, com cada passo provado por uma leitura que não fica verde quando o dado falta.

**Architecture:** quase tudo é do dono, por ssh e pela tela do TrueNAS e do B2. O agente entrega (1) código do kit da forja, com teste, em `~/Workspace/forja/ferramentas/arquivo/` (git local, `git commit -- <caminhos>`); (2) um teste de trava no site; (3) os arquivos de comandos do dono, um por bloco, com saída em `saidas/`, e as conferências só de leitura. A M3a não instala programa que grave arquivo nem bloco no `pulso.sh`: isso é da M3b; aqui eles ficam escritos, testados e com a interface registrada.

**Tech Stack:** TrueNAS SCALE 25.10.4 (ZFS, NFS 4.1, Cloud Sync = `rclone`), Backblaze B2, Ubuntu 24.04 na forja (systemd, Python 3.12 do sistema, `rclone` 1.60.1 do repositório), bash, healthchecks.io; no site, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` (partes 00 a 06; aprovado em 14/10, commit `8b4dd7b61`). Trechos que este plano implementa: `05` §15.1 (linha M3a) e §16.4; `02` §9.4, §10.9, §11.1; `01` §6.3, §6.4, §7.2, §7.3, §7.5; `06` §18 itens 2, 16, 17, 18, 33 e a parte de kit do 134. Decisões do dono de 14/10: `.superpowers/sdd/manutencao-nas/decisoes-dono-14-10.md`. Runbook da forja: `docs/ops/forja-fila-inteligencia-runbook.md`.

## Global Constraints

- **NAS e forja: escrita é do dono, sem exceção.** O agente nunca roda `ssh forja '<escreve>'`, `scp`, `install`, `systemctl`, `crontab` nem `ssh nas '<escreve>'`. Leitura por `ssh forja '<leitura>'` é permitida.
- **Formato dos comandos do dono:** um arquivo de comandos por bloco, curtos, um por linha, e uma linha curta que o roda; saída em `.superpowers/sdd/manutencao-nas/saidas/`. Nada para colar, salvo as exceções do `05` §16. **Na M3a só há a exceção do segredo** (senha e sal da cifra, chaves do B2): não há linha de cron (é da M3b) nem SQL de painel.
- **`sudo` na forja pede senha** (CP17, MEDIDO pelo agente em 14/10 às 08:31: `sudo: a password is required`). Todo comando com `sudo` usa `ssh -t`; a M3a junta os passos de root num script só, para uma senha só.
- **O sistema falha em VERDE.** Cada conferência diz primeiro o que acontece quando o dado não existe (bucket vazio, montagem ausente, arquivo de registro velho) e só depois o que acontece quando dá erro.
- **Chave da cifra:** gerada no cofre do dono (Vaultwarden do NAS, resposta 1 de 14/10) **antes** de criar a tarefa; a forja recebe a cópia **a partir do cofre, nunca do TrueNAS** (`02` §9.4, §10.9). A segunda guarda, fora do NAS e da forja, é recomendada já e obrigatória antes do passo 17 do ensaio e do primeiro descarte real (`02` §9.4; item 17).
- **Bucket:** novo, privado, sem Object Lock, versões anteriores por 30 dias (resposta 3 de 14/10). Sem alerta de gasto no B2 (resposta 9 de 14/10).
- **Três chaves do B2, revogáveis uma a uma:** escrita do TrueNAS (só o bucket do arquivo), leitura do Mac, leitura da forja (`02` §11.1).
- **Três chaves de API, sem revogar nenhuma existente:** `copiador` (`archive_copy`), `respondedor` (`archive_read`), `conferidor` (`archive_b2`) (`05` §16.4 passos 7 e 8).
- **Healthchecks:** "Arquivo: copiador" 12 h com folga de 3 h; "Arquivo: conferência do B2" e "Arquivo: pulso", 24 h com folga de 6 h (`05` §16.4 passo 8). **Os blocos e as verificações da fila de inteligência não são tocados** (item 33).
- **Kit:** toda mudança termina em `git -C ~/Workspace/forja/ferramentas commit -m "<tipo>: <descrição>" -- <caminhos>`, e nada vai à forja com mudança sem commit (`05` §16.5).
- **Site:** commits no `staging`, um por tarefa, por caminho explícito (`git commit -- <caminhos>`); nunca `git add -A`, stash ou reset. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Sem datas-meta;** a M3a não espera relógio nenhum (`05` §15.1).

## Review Focus

1. **Chave da cifra errada com a cifra de nome desligada:** com `filename_encryption = off` os nomes no B2 ficam legíveis com qualquer chave, então "a lista sai legível" (a conferência do `05` §16.4 passo 8) passa com a chave errada. Só o conteúdo prova. O bloco 10 decifra um arquivo de prova e compara o sha256 com o do NAS (Tarefa 8; a regra está no Bloco 10 da Tarefa 9).
2. **Montagem ausente com `nofail`:** sem o NFS, `/mnt/arquivo/escrita/<filho>` é disco local da forja e o `touch` da prova dá certo. A prova de escrita lê no NAS, dentro do filho, com `df --output=source` (Tarefa 8, `m3a-6-prova-escrita.sh`).
3. **Registro com mtime novo e execução velha:** uma execução `--prova` à mão renova o mtime do `.jsonl` sem que o cron tenha rodado. Os blocos do pulso medem a idade pelo `quando` da última linha `modo: cron`, nunca pelo mtime (Tarefa 6, casos "prova não renova").
4. **URL repetida no pulso:** colar a URL da fila ou a principal num bloco do arquivo faria um vermelho do arquivo pintar outro assunto. O instalador recusa URL já presente no `pulso.sh` e URLs repetidas entre os três (Tarefa 6).
5. **Repetir um bloco depois de parar no meio:** chave já gerada, `rclone.conf` já escrito, unidades já instaladas. `nova_chave_arquivo.py` nunca sobrescreve e devolve o hash da existente; o seed é idempotente; `configurar_rclone.py` recusa sem `--trocar`; o instalador é idempotente (Tarefas 2, 3, 4 e 5).

---

## Fatos usados (com fonte)

| Fato | Fonte |
|---|---|
| `pulso.sh` vivo: 150 linhas; âncora `[ "$ok" -eq 1 ] && alvo="$URL" ...` na linha 130, uma vez; bloco `fila_intel (F4)` antes dela; variáveis `ok`, `motivo`, `URL` | Lido pelo agente em 14/10 por `ssh forja 'cat /opt/agente/docs/pulso.sh'` (cópia em scratchpad, não commitada) |
| Molde do instalador de bloco: `fase2/pulso_f4.py` (marcadores, recusa de URL fora de `^https://hc-ping\.com/[0-9a-f-]{36}$`, recusa de segunda inserção, `pulso.sh.tmp` em `0600`) e o teste `fase2/teste_pulso_fila.py` (curl e sleep falsos no PATH) | `~/Workspace/forja/ferramentas/fase2/pulso_f4.py:1-140`, `teste_pulso_fila.py:1-180` |
| Molde de montagem: `mnt-biblioteca-pedidos.mount`, `What=100.109.2.17:/mnt/fast/biblioteca-pedidos`, `Options=rw,nosuid,nodev,noexec,noatime,_netdev,soft,timeo=50,retrans=2,nfsvers=4.1,nofail`, `After=tailscale-online.target network-online.target`, `TimeoutSec=30`, `WantedBy=remote-fs.target` | Lido em 14/10 por `ssh forja 'cat /etc/systemd/system/mnt-biblioteca-pedidos.mount'` |
| Forja: sem `rclone` (candidato `1.60.1+dfsg-3ubuntu0.24.04.6`); sem `/opt/arquivo`, `/mnt/arquivo` e `~/.config/rclone`; disco sem cifra (CP30: `SEM-CIFRA`); relógio em `-03`; crontab com 4 linhas (pulso, retentar, fila, stats) | Lido em 14/10 às 08:31 por ssh (leitura) |
| `seed_chave_forja.sh` conhece dois modos (`<sha>` = leitura, `fila <sha>`); só `fila` revoga, e só com `CONFIRMAR_REVOGACAO=sim`; teste em `fase2/teste_seed_fila.sh` com `npx` falso | `~/Workspace/forja/ferramentas/seed_chave_forja.sh:1-146`, `fase2/teste_seed_fila.sh` |
| `nova_chave.py` gera `forja_` + `secrets.token_urlsafe(32)` e imprime só o sha256 | `~/Workspace/forja/ferramentas/docs/trilha/nova_chave.py:24-27` |
| `pipeline_api_keys.permissions` é `text[]` sem `check`: um valor novo (`archive_copy`) grava sem migration | `supabase/migrations/20260509000001_content_pipeline.sql:126-136` |
| `requirePermission` só reconhece `read`, `write`, `admin`, `intelligence`; uma chave só com `archive_*` não passa em nenhum | `apps/web/src/lib/pipeline/auth.ts:133-140` |
| Permissão desconhecida chega como texto, sem erro | `apps/web/src/lib/pipeline/chave.ts:99` |
| Tarefas do NAS para o B2: de 03:00 a 05:50 (appdata às 03:20); a última começa às 05:30 e às 05:50 | `.superpowers/sdd/manutencao-nas/saidas/nas-2026-10-14-0012.txt` |
| `fast/appdata` destrava sozinho (`keyformat hex`, `keylocation none`); snapshots recursivos de 2 semanas | idem, e `decisoes-dono-14-10.md` |
| O dono entra no NAS por `ssh nas` (do Mac) | `.superpowers/sdd/manutencao-nas/leituras-nas.sh:5` |

## Decisões deste plano (o que o spec deixou ao plano, ou que o plano muda com motivo)

| # | Decisão | Motivo |
|---|---|---|
| P1 | **A prova da chave na forja é de conteúdo, não de lista.** O bloco 10 decifra do B2 um arquivo de prova de 4 KiB aleatórios e compara o sha256 com o do NAS; e tenta ler um nome que não existe (controle negativo). Substitui o `rclone lsf arq: --max-depth 1` do `05` §16.4 passo 8 como critério | Com a cifra de nome desligada, a lista sai legível com qualquer senha, e com o bucket vazio sai vazia e com código zero. As duas são verde falso |
| P2 | **A chave de API de cada programa nasce na forja, num arquivo próprio** (`/opt/arquivo/chaves/<programa>.chave`, `0600`, pasta `0700`), gerada por `nova_chave_arquivo.py`; o Mac só recebe o sha256 | A chave nunca passa pelo Mac nem pela área de transferência. O `cp -n` do `.env` da M3b não sobrescreve nada aqui, e o passo "o dono cola a chave no `.env`" do `05` §16.5 deixa de existir (vai para a M3b como interface) |
| P3 | **`/opt/arquivo` nasce na M3a** (com `log/`, `ferramentas/`, `chaves/`) | As chaves e as ferramentas precisam de casa já; o `install -d` da M3b repete sem efeito |
| P4 | **Os passos de root na forja ficam num script do kit**, `instalar-casa-forja.sh`, rodado com uma senha só | Cinco `ssh -t ... sudo` seriam cinco senhas; o script é idempotente e testado |
| P5 | **Os blocos do `pulso.sh` são escritos e testados na M3a e instalados na M3b**, junto dos programas | Instalados hoje, falhariam de hora em hora ("registro ausente") e pintariam as verificações antes de existir o que vigiar. As verificações são criadas na M3a e ficam no estado "nova" até o primeiro sinal |
| P6 | **A tarefa nova do NAS roda às 06:10, hora do NAS, todo dia** | Depois das tarefas de hoje (a última começa às 05:50: CP21) e depois da execução das 03:17 do copiador; antes do `conferir-b2` das 11:07 da forja. O fuso do NAS é lido no bloco 0; se não for `America/Sao_Paulo`, a hora é refeita no bloco 3 |
| P7 | **Pasta no bucket: `site-arquivo`.** Os remotos do `rclone` na forja chamam-se `b2arq` (B2 cru) e `arq` (cifrado) | São os nomes que o spec já usa nas conferências (`01` CP32, `05` §16.4) |
| P8 | **`configurar_rclone.py` pede os segredos com `getpass` e obscurece pela entrada padrão** (`rclone obscure -`) | Na forma do spec (`rclone config create ... password="$ARQ_SENHA"`) o valor aparece na linha de comando do processo enquanto ele roda. A exceção do segredo continua a mesma: o dono digita na sessão |
| P9 | **As montagens de leitura usam `ro`, sem `nosharecache`.** A prova é escrever nelas e ver a recusa | NÃO VERIFICADO se o cliente NFS aceita a mesma exportação duas vezes com opções diferentes (CP10). Se a escrita passar, o plano B está no runbook (Tarefa 8) |
| P10 | **O bloco 5 instala o `rclone` e as duas ferramentas antes do CP16 (bloco 6).** Nenhuma delas grava no arquivo; o plano B do CP16 não as afeta. O que o spec proíbe antes da prova são os programas que gravam (M3b) | Desvio do `05` §16.4 passo 6 ("nada é instalado antes de a prova passar"), declarado. Se Phil ou o dono discordarem, o conserto é mover o passo 3/4 do instalador para um `instalar-casa-forja-2.sh` depois do bloco 6, ao custo de uma senha de sudo a mais |

## Interfaces registradas para a M3b (a M3a não implementa)

| Interface | Contrato |
|---|---|
| Chave de cada programa | Arquivo `/opt/arquivo/chaves/{copiador,respondedor,conferidor}.chave`, uma linha, `forja_...`, `0600`. O programa lê o caminho de uma variável com padrão (`ARQUIVO_CHAVE_ARQ`), e o teste que apaga a variável afirma o padrão (item 79) |
| Registro do copiador | `/opt/arquivo/log/copiador.jsonl`, uma linha por execução terminada, em `\n`: `{"quando": "<ISO com fuso>", "modo": "cron" \| "prova" \| ..., "desfecho": "ok" \| "<outro>"}`. Só `desfecho: "ok"` é verde no pulso. `nas_fora` e `nas_cheio` são desfechos (ficam vermelhos no pulso) |
| Registro do `conferir-b2` | `/opt/arquivo/log/conferir-b2.jsonl`, mesma forma. `desfecho: "ok"` quer dizer: controle negativo e canário passaram **e** todo arquivo que o plano pediu foi informado, com ao menos um `ok` quando o plano pediu algum. A linha traz `pedidos: <n>` e `informados: <n>`. Plano com zero arquivos e os dois controles certos é `ok` com `pedidos: 0` **e `estado: "aguardando_primeira_selagem"`** (o `estado` vem do **site**, no corpo do `GET plan` (`"primeira_selagem": null` quando nenhum mês foi selado no banco); o `conferir-b2` só copia, nunca deduz de `pedidos == 0`. Com mês selado e plano vazio, o site responde `pedidos: 0` **sem** o `estado`, e o pulso fica vermelho (`arquivo-b2-pedidos-0-sem-estado`). Teste da M3b: banco com um mês selado e plano vazio ⇒ linha sem `estado`): é o estado normal antes da primeira selagem (outubro sela em 28/11), e a linha e a página do site mostram essa frase ("aguardando primeira selagem"), nunca um `ok` mudo. Sem arquivo pedido, o verde só afirma que os dois controles passaram, não que algum mês foi conferido. `pedidos: 0` sem o `estado` é registro inválido (vermelho no pulso, `arquivo-b2-pedidos-0-sem-estado`). `pedidos > 0` com `informados < pedidos` sem `timeout` é `incompleto` (vermelho). `controle_falhou`, `chave_ausente`, `desligado` (variável `OBS_ARQUIVO_CONFERIR_B2` ausente) e `sem_acesso` são vermelhos |
| Plano em disco | `/opt/arquivo/estado/plano.json`, gravado pelo copiador (temporário + `rename`) depois de cada `GET plan` respondido: `{"obtido_em": "<ISO com fuso, hora da forja>", "vermelhos": [<texto>, ...]}` copiado do plano. Ausente, ilegível, sem `obtido_em`, com 13 horas ou mais, ou com `vermelhos` ausente ou nulo: o pulso falha |
| Remotos do `rclone` | `b2arq:` (tipo `b2`, chave de leitura da forja) e `arq:` (tipo `crypt`, `remote = b2arq:<bucket>/site-arquivo`, `filename_encryption = off`). O `conferir-b2` afirma na execução que `arq:` é `crypt` sobre `b2` |
| `fileId` (Su1 do Yannis, rodada 14) | O site **guarda** o `fileId` da última conferência boa de cada arquivo, não só o do último informe; é por ele que a restauração depois de uma varredura escolhe a versão (`02` §10.10). O bloco 10 registra no ledger se o `rclone lsjson` da 1.60.1 traz o campo `ID` dos objetos do B2: é de onde o `conferir-b2` tira o `fileId`. `uploadTimestamp`: fonte medida no bloco 10 (campo e versão do `rclone`); nunca o `ModTime`, que no B2 pode ser a hora do arquivo no NAS e não a do envio |
| Nome no B2 | NÃO VERIFICADO: com `filename_encryption = off` o `rclone` grava o objeto com sufixo `.bin`. O bloco 10 registra o nome cru; a M3b usa o nome cru na busca de versões e o expurgo usa o nome cru no painel |
| Pulso | O instalador `arquivo/pulso_arquivo.py` (Tarefa 6) é rodado na M3b, no diretório do `pulso.sh`, com as três URLs, seguido de `bash -n`, `python3 teste_pulso_arquivo.py pulso.sh.tmp`, `chmod 755` e `mv`, como no runbook da fila (§3, passo 7). **A conferência da M3b vê cada uma das três verificações sair do estado "nova"**: uma verificação que nunca recebeu sinal não avisa nada |
| Hora do `conferir-b2` | Continua 11:07 no relógio da forja (CP21 respondida: todas as tarefas do NAS começam até 05:50, e a nova às 06:10) |
| Canário | O `conferir-b2` só procura `_canario/<AAAA-MM-DD>` pelo nome exato que o site manda (o do dia informado pelo copiador) e ignora todo nome fora de `^\d{4}-\d{2}-\d{2}$`. O controle positivo do `apagado_b2` só vale com nome e `fileId` de um canário que o site conhece. `_canario/prova-m3a` existe nos dois filhos, no NAS e no B2, desde a M3a, e um teste da M3b o coloca na pasta falsa e afirma que ele não muda resultado nenhum |
| Controle negativo | O verificador separa por causa: só a mensagem *not found* do `rclone` vale como "ausente" (`arquivo_ausente`, retira a atestação). Qualquer outro erro (rede, chave do B2 errada, `rclone.conf` ausente, B2 fora do ar) é `sem_acesso` ou `divergente`, que não retiram nada (`02` §10.9). Senha ou sal errados dão ERRO de autenticação do bloco cifrado, nunca conteúdo diferente. O bloco 10 registra no ledger a frase real de cada caso. `arquivo_ausente` só pode ser informado numa execução em que o canário do **mesmo filho** foi lido e conferiu (`sha256` igual ao informado pelo copiador). Canário do filho com *not found* ou com erro ⇒ todos os arquivos daquele filho saem `sem_acesso`, e a execução é `controle_falhou`. Teste da M3b: `rclone.conf` com prefixo trocado ⇒ zero `arquivo_ausente`, desfecho `controle_falhou` |
| Espaço do NAS | O "NAS cheio" e o alarme de 80% leem o `avail` que a montagem devolve (`statvfs`), que já desconta a `quota` do pai e os snapshots (pela `quota` do pai os snapshots contam; pela `refquota` dos filhos, não). Nunca `refquota - used` |
| `/opt/arquivo` | A instalação da M3b nunca usa `rsync --delete` nem `rm -r` sobre `/opt/arquivo`, que guarda as chaves. `estado/` nasce na M3a |

---

## Estrutura de arquivos

Kit (`~/Workspace/forja/ferramentas`, git local):

| Arquivo | Responsabilidade |
|---|---|
| `arquivo/mnt-arquivo-escrita-numerico.mount`, `...-escrita-texto.mount`, `...-leitura-numerico.mount`, `...-leitura-texto.mount` | As quatro montagens NFS |
| `arquivo/teste_montagens.py` | Prova as quatro unidades contra o contrato do `02` §9.4 |
| `arquivo/instalar-casa-forja.sh` | Passos de root na forja, idempotentes |
| `arquivo/teste_instalar_casa.sh` | Prova o instalador no Mac, com raiz falsa |
| `arquivo/nova_chave_arquivo.py` | Gera ou devolve o hash da chave de um programa |
| `arquivo/teste_nova_chave_arquivo.py` | Prova o gerador |
| `seed_chave_forja.sh` (alterado) | Três modos novos, sem revogação |
| `arquivo/teste_seed_arquivo.sh` | Prova os modos novos; `fase2/teste_seed_fila.sh` continua passando |
| `arquivo/configurar_rclone.py` | Escreve `~/.config/rclone/rclone.conf` com os remotos `b2arq` e `arq` |
| `arquivo/teste_configurar_rclone.py` | Prova a configuração com `rclone` falso |
| `arquivo/pulso_arquivo.py` | Os três blocos do pulso e o instalador |
| `arquivo/teste_pulso_arquivo.py` | Prova os blocos e o instalador |

Site (`~/Workspace/bythiagofigueiredo`):

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/test/lib/pipeline/helpers-leitura.test.ts` (alterado) | Trava (I1 do Yannis): chaves `archive_*` nunca escrevem nem pegam tarefa, em nenhum modo; no modo aviso leem como qualquer chave sem `read` e toda leitura é registrada; no modo recusa levam 403 |
| `apps/web/test/lib/pipeline/auth.test.ts` (alterado) | Trava barata: `requirePermission` nega as quatro permissões a uma chave só com `archive_*` |
| `.superpowers/sdd/manutencao-nas/m3a/m3a-0-leituras-antes.sh` ... `m3a-11-conferencia-final.sh` | Os arquivos de comandos do dono |
| `.superpowers/sdd/manutencao-nas/m3a/m3a-7-segunda-versao.sh`, `m3a-11a-limpar-prova-exclusao.sh` | Escritas do dono dos blocos 7 e 11 (segunda versão do canário; apagar as provas de exclusão) |
| `.superpowers/sdd/manutencao-nas/m3a/m3a-10a-permissoes.sh`, `m3a-pb-cp16.sh`, `m3a-pb-cp10.sh`, `m3a-pb-rclone.sh`, `m3a-desfazer-forja.sh`, `m3a-desfazer-banco.sh`, `m3a-rotacao-chave.sh` | Planos B, volta atrás e rotação como ARQUIVOS de comandos (o RUNBOOK não traz comando de escrita para colar) |
| `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (alterado) | A seção "AGORA" com o caminho da M3a |
| `.superpowers/sdd/manutencao-nas/RUNBOOK-rollback-e-referencia.md` (novo) | Volta atrás e planos B da M3a |
| `.superpowers/sdd/manutencao-nas/m3a-progresso.md` (novo) | Ledger da M3a |

---

### Task 1: As quatro unidades de montagem

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-escrita-numerico.mount`
- Create: `~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-escrita-texto.mount`
- Create: `~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-leitura-numerico.mount`
- Create: `~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-leitura-texto.mount`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_montagens.py`

**Interfaces:**
- Consumes: nada.
- Produces: os quatro nomes de unidade, usados pelo `instalar-casa-forja.sh` (Tarefa 2) e pelos comandos do dono (Tarefa 8). Pontos de montagem: `/mnt/arquivo/{escrita,leitura}/{numerico,texto}`.

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_montagens.py`:

```python
"""M3a: prova as quatro unidades de montagem do arquivo contra o contrato (spec 02 §9.4, F33).
Uso:  python3 ~/Workspace/forja/ferramentas/arquivo/teste_montagens.py"""
import glob, os, re

AQUI = os.path.dirname(os.path.abspath(__file__))
NAS = "100.109.2.17"
BASE_NAS = "/mnt/fast/appdata/site-arquivo"
COMUNS = {"nosuid", "nodev", "noexec", "noatime", "_netdev", "soft", "timeo=50", "retrans=2",
          "nfsvers=4.1", "nofail"}
falhas = []


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def le(caminho):
    """systemd aceita chave repetida; aqui cada chave aparece uma vez, e o teste exige isso."""
    secoes, atual = {}, None
    for linha in open(caminho, encoding="utf-8"):
        linha = linha.strip()
        if not linha or linha.startswith("#"):
            continue
        m = re.match(r"^\[(\w+)\]$", linha)
        if m:
            atual = secoes.setdefault(m.group(1), {})
            continue
        k, _, v = linha.partition("=")
        exige(k not in atual, "%s: chave %s uma vez só" % (os.path.basename(caminho), k))
        atual[k] = v
    return secoes


arquivos = sorted(glob.glob(os.path.join(AQUI, "mnt-arquivo-*.mount")))
exige(len(arquivos) == 4, "são exatamente quatro unidades (%d)" % len(arquivos))
vistos = set()
for caminho in arquivos:
    nome = os.path.basename(caminho)
    m = re.match(r"^mnt-arquivo-(escrita|leitura)-(numerico|texto)\.mount$", nome)
    exige(bool(m), "%s: nome no formato mnt-arquivo-<modo>-<filho>.mount" % nome)
    if not m:
        continue
    modo, filho = m.groups()
    vistos.add((modo, filho))
    s = le(caminho)
    unit, mount, inst = s.get("Unit", {}), s.get("Mount", {}), s.get("Install", {})
    where = "/mnt/arquivo/%s/%s" % (modo, filho)
    exige(mount.get("Where") == where, "%s: Where=%s" % (nome, where))
    exige(nome == where.strip("/").replace("/", "-") + ".mount", "%s: nome bate com Where (systemd)" % nome)
    exige(mount.get("What") == "%s:%s/%s" % (NAS, BASE_NAS, filho),
          "%s: What é a exportação do FILHO, nunca a do pai" % nome)
    exige(mount.get("Type") == "nfs4", "%s: Type=nfs4" % nome)
    opcoes = set(mount.get("Options", "").split(","))
    exige(COMUNS <= opcoes, "%s: opções do molde soft (%s)" % (nome, ",".join(sorted(COMUNS - opcoes))))
    exige("hard" not in opcoes, "%s: nunca hard" % nome)
    exige(("rw" in opcoes) == (modo == "escrita") and ("ro" in opcoes) == (modo == "leitura"),
          "%s: rw só na escrita, ro só na leitura" % nome)
    exige(mount.get("TimeoutSec") == "30", "%s: TimeoutSec=30" % nome)
    exige("tailscale-online.target" in unit.get("After", "").split(), "%s: depois da rede privada" % nome)
    exige("tailscale-online.target" in unit.get("Wants", "").split(), "%s: Wants da rede privada" % nome)
    exige(inst.get("WantedBy") == "remote-fs.target", "%s: WantedBy=remote-fs.target" % nome)
exige(vistos == {(a, b) for a in ("escrita", "leitura") for b in ("numerico", "texto")},
      "as quatro combinações modo x filho existem")
print("\nmontagens: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_montagens.py`
Expected: `FALHA são exatamente quatro unidades (0)` e `montagens: 2 falha(s)`, saída 1.

- [ ] **Step 3: Escrever as quatro unidades**

`arquivo/mnt-arquivo-escrita-numerico.mount`:

```ini
# Arquivo do site (fase de manutenção, M3a): filho "numerico" de fast/appdata/site-arquivo no NAS, ESCRITA (copiador).
# Uma exportação por filho, nunca a do pai (spec 02 §9.4): a do pai não atravessa para os filhos, e a forja gravaria
# por baixo da montagem, num lugar que a tarefa de cópia para o B2 não lê.
# soft + nofail como a caixa de pedidos (mnt-biblioteca-pedidos.mount): NAS fora falha em segundos e a forja sobe igual.
# Sem a montagem, este diretório é disco LOCAL da forja: quem grava exige a sentinela .arquivo-vivo, que só existe no NAS.
# Instalado por arquivo/instalar-casa-forja.sh (copia para /etc/systemd/system/). Não edite lá: edite aqui.
[Unit]
Description=Arquivo do site - numerico (escrita) no NAS (fast/appdata/site-arquivo/numerico)
Wants=tailscale-online.target network-online.target
After=tailscale-online.target network-online.target

[Mount]
What=100.109.2.17:/mnt/fast/appdata/site-arquivo/numerico
Where=/mnt/arquivo/escrita/numerico
Type=nfs4
Options=rw,nosuid,nodev,noexec,noatime,_netdev,soft,timeo=50,retrans=2,nfsvers=4.1,nofail
TimeoutSec=30

[Install]
WantedBy=remote-fs.target
```

`arquivo/mnt-arquivo-escrita-texto.mount`:

```ini
# Arquivo do site (fase de manutenção, M3a): filho "texto" de fast/appdata/site-arquivo no NAS, ESCRITA (copiador).
# Uma exportação por filho, nunca a do pai (spec 02 §9.4). soft + nofail como mnt-biblioteca-pedidos.mount.
# Sem a montagem, este diretório é disco LOCAL da forja: quem grava exige a sentinela .arquivo-vivo, que só existe no NAS.
# Instalado por arquivo/instalar-casa-forja.sh (copia para /etc/systemd/system/). Não edite lá: edite aqui.
[Unit]
Description=Arquivo do site - texto (escrita) no NAS (fast/appdata/site-arquivo/texto)
Wants=tailscale-online.target network-online.target
After=tailscale-online.target network-online.target

[Mount]
What=100.109.2.17:/mnt/fast/appdata/site-arquivo/texto
Where=/mnt/arquivo/escrita/texto
Type=nfs4
Options=rw,nosuid,nodev,noexec,noatime,_netdev,soft,timeo=50,retrans=2,nfsvers=4.1,nofail
TimeoutSec=30

[Install]
WantedBy=remote-fs.target
```

`arquivo/mnt-arquivo-leitura-numerico.mount`:

```ini
# Arquivo do site (fase de manutenção, M3a): filho "numerico", SÓ LEITURA (respondedor).
# O ro protege contra defeito do programa, não contra invasão: quem decide a montagem é o cliente (spec 02 §9.4).
# Se o cliente NFS não aceitar a mesma exportação montada duas vezes com opções diferentes (CP10), o respondedor usa a
# montagem de escrita com ReadOnlyPaths= na unidade do serviço (M3b). A prova está no m3a-6-prova-escrita.sh.
# Instalado por arquivo/instalar-casa-forja.sh (copia para /etc/systemd/system/). Não edite lá: edite aqui.
[Unit]
Description=Arquivo do site - numerico (leitura) no NAS (fast/appdata/site-arquivo/numerico)
Wants=tailscale-online.target network-online.target
After=tailscale-online.target network-online.target

[Mount]
What=100.109.2.17:/mnt/fast/appdata/site-arquivo/numerico
Where=/mnt/arquivo/leitura/numerico
Type=nfs4
Options=ro,nosuid,nodev,noexec,noatime,_netdev,soft,timeo=50,retrans=2,nfsvers=4.1,nofail
TimeoutSec=30

[Install]
WantedBy=remote-fs.target
```

`arquivo/mnt-arquivo-leitura-texto.mount`:

```ini
# Arquivo do site (fase de manutenção, M3a): filho "texto", SÓ LEITURA (respondedor).
# O ro protege contra defeito do programa, não contra invasão (spec 02 §9.4). Plano B do CP10: ReadOnlyPaths= (M3b).
# Instalado por arquivo/instalar-casa-forja.sh (copia para /etc/systemd/system/). Não edite lá: edite aqui.
[Unit]
Description=Arquivo do site - texto (leitura) no NAS (fast/appdata/site-arquivo/texto)
Wants=tailscale-online.target network-online.target
After=tailscale-online.target network-online.target

[Mount]
What=100.109.2.17:/mnt/fast/appdata/site-arquivo/texto
Where=/mnt/arquivo/leitura/texto
Type=nfs4
Options=ro,nosuid,nodev,noexec,noatime,_netdev,soft,timeo=50,retrans=2,nfsvers=4.1,nofail
TimeoutSec=30

[Install]
WantedBy=remote-fs.target
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_montagens.py`
Expected: `montagens: 0 falha(s)`, saída 0.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/mnt-arquivo-escrita-numerico.mount arquivo/mnt-arquivo-escrita-texto.mount arquivo/mnt-arquivo-leitura-numerico.mount arquivo/mnt-arquivo-leitura-texto.mount arquivo/teste_montagens.py
git -C $K commit -m "feat: arquivo M3a, as quatro montagens NFS do arquivo (escrita e leitura por filho) com teste do contrato" -- arquivo/mnt-arquivo-escrita-numerico.mount arquivo/mnt-arquivo-escrita-texto.mount arquivo/mnt-arquivo-leitura-numerico.mount arquivo/mnt-arquivo-leitura-texto.mount arquivo/teste_montagens.py
```

---

### Task 2: O instalador de root na forja

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/instalar-casa-forja.sh`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_instalar_casa.sh`

**Interfaces:**
- Consumes: as quatro unidades (Tarefa 1); `nova_chave_arquivo.py` (Tarefa 3) e `configurar_rclone.py` (Tarefa 5) como arquivos a copiar (o teste copia os do kit; antes das Tarefas 3 e 5 existirem o teste cria arquivos vazios com esses nomes, ver Step 1).
- Produces: na forja, `/mnt/arquivo/{escrita,leitura}/{numerico,texto}` montados; `/opt/arquivo/{log,ferramentas,estado}` (`755`, do `thiago`); `/opt/arquivo/chaves` (`700`, do `thiago`); `/opt/arquivo/ferramentas/{nova_chave_arquivo.py,configurar_rclone.py}`; `rclone` 1.60 ou maior. Uso: `sudo bash /home/thiago/.arquivo-m3a/instalar-casa-forja.sh` (pasta `700` do `thiago`, nunca `/tmp`, que é `1777`).

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_instalar_casa.sh`:

```bash
#!/bin/bash
# Prova o instalar-casa-forja.sh NO MAC, sem root e sem tocar a forja: RAIZ falsa e systemctl, apt-get e rclone falsos.
# Uso: bash ~/Workspace/forja/ferramentas/arquivo/teste_instalar_casa.sh
set -uo pipefail
AQUI=$(cd "$(dirname "$0")" && pwd)
ALVO="$AQUI/instalar-casa-forja.sh"
falhas=0
ok() { if [ "$2" = ok ]; then echo "OK    $1"; else echo "FALHA $1 — ${3:-}"; falhas=$((falhas+1)); fi; }
modo() { python3 -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777))' "$1"; }

prepara() {   # prepara <primeira linha do 'rclone version' falso, ou "ausente">  -> define T
  T=$(mktemp -d); mkdir -p "$T/raiz/etc/systemd/system" "$T/origem" "$T/bin"
  cp "$AQUI"/mnt-arquivo-*.mount "$T/origem/"
  for f in nova_chave_arquivo.py configurar_rclone.py; do
    if [ -f "$AQUI/$f" ]; then cp "$AQUI/$f" "$T/origem/"; else : > "$T/origem/$f"; fi
  done
  cat > "$T/bin/systemctl" <<FIM
#!/bin/sh
echo "systemctl \$*" >> "$T/chamadas"
FIM
  cat > "$T/bin/apt-get" <<FIM
#!/bin/sh
echo "apt-get \$*" >> "$T/chamadas"
printf '#!/bin/sh\necho rclone v1.60.1-DEV\n' > "$T/bin/rclone"
chmod 755 "$T/bin/rclone"
FIM
  if [ "$1" != ausente ]; then printf '#!/bin/sh\necho "%s"\n' "$1" > "$T/bin/rclone"; chmod 755 "$T/bin/rclone"; fi
  chmod 755 "$T/bin/systemctl" "$T/bin/apt-get"
}
roda() { RAIZ="$T/raiz" ORIGEM="$T/origem" DONO="" PATH="$T/bin:/usr/bin:/bin" bash "$ALVO" > "$T/saida" 2>&1; RC=$?; }

# --- caminho feliz, rclone já presente ---
prepara "rclone v1.60.1-DEV"; roda
[ "$RC" = 0 ] && ok "feliz: sai 0" ok || ok "feliz: sai 0" nao "rc=$RC :: $(cat "$T/saida")"
n=$(ls "$T/raiz/etc/systemd/system"/mnt-arquivo-*.mount 2>/dev/null | wc -l | tr -d ' ')
[ "$n" = 4 ] && ok "feliz: quatro unidades instaladas" ok || ok "feliz: quatro unidades instaladas" nao "$n"
for d in escrita/numerico escrita/texto leitura/numerico leitura/texto; do
  [ -d "$T/raiz/mnt/arquivo/$d" ] && ok "feliz: ponto /mnt/arquivo/$d" ok || ok "feliz: ponto /mnt/arquivo/$d" nao "faltou"
done
[ "$(modo "$T/raiz/opt/arquivo/chaves")" = 0o700 ] && ok "feliz: chaves/ em 700" ok || ok "feliz: chaves/ em 700" nao "$(modo "$T/raiz/opt/arquivo/chaves")"
for d in log ferramentas estado; do
  [ -d "$T/raiz/opt/arquivo/$d" ] && ok "feliz: /opt/arquivo/$d" ok || ok "feliz: /opt/arquivo/$d" nao "faltou"
done
for f in nova_chave_arquivo.py configurar_rclone.py; do
  [ -f "$T/raiz/opt/arquivo/ferramentas/$f" ] && ok "feliz: ferramentas/$f" ok || ok "feliz: ferramentas/$f" nao "faltou"
done
grep -qx "systemctl daemon-reload" "$T/chamadas" && ok "feliz: daemon-reload" ok || ok "feliz: daemon-reload" nao "$(cat "$T/chamadas")"
grep -qx "systemctl enable --now mnt-arquivo-escrita-numerico.mount mnt-arquivo-escrita-texto.mount mnt-arquivo-leitura-numerico.mount mnt-arquivo-leitura-texto.mount" "$T/chamadas" \
  && ok "feliz: enable --now das quatro" ok || ok "feliz: enable --now das quatro" nao "$(cat "$T/chamadas")"
grep -q "^apt-get" "$T/chamadas" && ok "feliz: sem apt-get com rclone presente" nao "chamou apt-get" || ok "feliz: sem apt-get com rclone presente" ok

# --- repetir não muda nada ---
antes=$(cd "$T/raiz" && find . | sort)
roda
depois=$(cd "$T/raiz" && find . | sort)
{ [ "$RC" = 0 ] && [ "$antes" = "$depois" ]; } && ok "repetir: sai 0 e a árvore é a mesma" ok || ok "repetir: sai 0 e a árvore é a mesma" nao "rc=$RC"

# --- rclone ausente: instala pelo apt-get, uma vez ---
prepara ausente; roda
{ [ "$RC" = 0 ] && [ "$(grep -c '^apt-get install -y rclone$' "$T/chamadas")" = 1 ]; } \
  && ok "ausente: apt-get install -y rclone uma vez" ok || ok "ausente: apt-get install -y rclone uma vez" nao "rc=$RC :: $(cat "$T/chamadas" 2>/dev/null)"

# --- rclone velho: para ---
prepara "rclone v1.59.2"; roda
{ [ "$RC" != 0 ] && grep -q PARE "$T/saida"; } && ok "1.59: para" ok || ok "1.59: para" nao "rc=$RC"
prepara "rclone v2.0.0"; roda
[ "$RC" = 0 ] && ok "2.0: aceita" ok || ok "2.0: aceita" nao "rc=$RC :: $(cat "$T/saida")"
prepara "saida estranha"; roda
[ "$RC" != 0 ] && ok "versão ilegível: para" ok || ok "versão ilegível: para" nao "rc=$RC"

# --- falta uma unidade: para antes de chamar o systemctl ---
prepara "rclone v1.60.1-DEV"; rm "$T/origem/mnt-arquivo-leitura-texto.mount"; roda
{ [ "$RC" != 0 ] && [ ! -f "$T/chamadas" ]; } && ok "falta unidade: para sem systemctl" ok || ok "falta unidade: para sem systemctl" nao "rc=$RC"

# --- sem RAIZ e sem root: para ---
prepara "rclone v1.60.1-DEV"
ORIGEM="$T/origem" PATH="$T/bin:/usr/bin:/bin" bash "$ALVO" > "$T/saida" 2>&1; RC=$?
if [ "$(id -u)" != 0 ]; then
  { [ "$RC" != 0 ] && grep -q "sudo" "$T/saida"; } && ok "sem root: para" ok || ok "sem root: para" nao "rc=$RC"
fi

echo; echo "instalar-casa: $falhas falha(s)"; [ "$falhas" = 0 ]
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bash ~/Workspace/forja/ferramentas/arquivo/teste_instalar_casa.sh`
Expected: falhas em todos os casos (o `instalar-casa-forja.sh` não existe: `bash: ... No such file or directory`), linha final `instalar-casa: N falha(s)` com N > 0, saída 1.

- [ ] **Step 3: Escrever o instalador**

`arquivo/instalar-casa-forja.sh`:

```bash
#!/bin/bash
# M3a: o que é de root na forja para a casa do arquivo. Idempotente: repetir não muda nada.
# Uso, na forja (pelo m3a-5-forja-instalar.sh, que copia tudo para /home/thiago/.arquivo-m3a antes):
#   sudo bash /home/thiago/.arquivo-m3a/instalar-casa-forja.sh
# RAIZ e DONO existem só para o teste (teste_instalar_casa.sh); em produção RAIZ é vazia e DONO é thiago.
set -euo pipefail
RAIZ="${RAIZ:-}"
ORIGEM="${ORIGEM:-/home/thiago/.arquivo-m3a}"
DONO="${DONO-thiago}"
DE_QUEM=${DONO:+-o $DONO -g $DONO}
UNIDADES="mnt-arquivo-escrita-numerico.mount mnt-arquivo-escrita-texto.mount mnt-arquivo-leitura-numerico.mount mnt-arquivo-leitura-texto.mount"
pare() { echo "PARE: $*" >&2; exit 1; }

[ -n "$RAIZ" ] || [ "$(id -u)" = 0 ] || pare "rode com sudo (ssh -t forja 'sudo bash ...')"
for u in $UNIDADES; do [ -f "$ORIGEM/$u" ] || pare "falta $ORIGEM/$u: nada foi instalado"; done
for f in nova_chave_arquivo.py configurar_rclone.py; do [ -f "$ORIGEM/$f" ] || pare "falta $ORIGEM/$f: nada foi instalado"; done

echo "1/4 pontos de montagem e unidades"
mkdir -p "$RAIZ/mnt/arquivo/escrita/numerico" "$RAIZ/mnt/arquivo/escrita/texto" \
         "$RAIZ/mnt/arquivo/leitura/numerico" "$RAIZ/mnt/arquivo/leitura/texto"
for u in $UNIDADES; do install -m 644 "$ORIGEM/$u" "$RAIZ/etc/systemd/system/$u"; done
systemctl daemon-reload
# Sem a exportação no NAS a montagem falha aqui, e o set -e para tudo: é o sinal de voltar ao bloco 3.
systemctl enable --now $UNIDADES

echo "2/4 /opt/arquivo"
# Nunca rsync --delete nem rm -r sobre /opt/arquivo: a pasta guarda as chaves. estado/ recebe o plano.json (M3b).
install -d -m 755 $DE_QUEM "$RAIZ/opt/arquivo" "$RAIZ/opt/arquivo/log" "$RAIZ/opt/arquivo/ferramentas" "$RAIZ/opt/arquivo/estado"
install -d -m 700 $DE_QUEM "$RAIZ/opt/arquivo/chaves"
install -m 755 $DE_QUEM "$ORIGEM/nova_chave_arquivo.py" "$ORIGEM/configurar_rclone.py" "$RAIZ/opt/arquivo/ferramentas/"

echo "3/4 rclone"
command -v rclone >/dev/null 2>&1 || DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get install -y rclone
linha=$(rclone version 2>/dev/null | head -1 || true)
v=$(printf '%s\n' "$linha" | sed -nE 's/^rclone v([0-9]+)\.([0-9]+).*/\1 \2/p')
[ -n "$v" ] || pare "versão do rclone ilegível: '$linha'"
set -- $v
{ [ "$1" -gt 1 ] || { [ "$1" = 1 ] && [ "$2" -ge 60 ]; }; } || pare "rclone abaixo de 1.60: '$linha'"

echo "4/4 pronto: $linha"
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bash ~/Workspace/forja/ferramentas/arquivo/teste_instalar_casa.sh && bash -n ~/Workspace/forja/ferramentas/arquivo/instalar-casa-forja.sh && echo SINTAXE-OK`
Expected: `instalar-casa: 0 falha(s)` e `SINTAXE-OK`.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/instalar-casa-forja.sh arquivo/teste_instalar_casa.sh
git -C $K commit -m "feat: arquivo M3a, instalador de root idempotente da casa na forja (montagens, /opt/arquivo, rclone >= 1.60)" -- arquivo/instalar-casa-forja.sh arquivo/teste_instalar_casa.sh
```

---

### Task 3: A chave de API de cada programa, gerada na forja

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/nova_chave_arquivo.py`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_nova_chave_arquivo.py`

**Interfaces:**
- Consumes: `/opt/arquivo/chaves/` em `700` (Tarefa 2).
- Produces: `python3 /opt/arquivo/ferramentas/nova_chave_arquivo.py <copiador|respondedor|conferidor>` → imprime só o sha256 (64 hex) em stdout, saída 0; cria `/opt/arquivo/chaves/<programa>.chave` (`0600`, `forja_...\n`) se não existir, e nunca sobrescreve. `caminho(programa) -> str`, `base() -> str` (padrão `/opt/arquivo`, trocável por `ARQUIVO_BASE`).

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_nova_chave_arquivo.py`:

```python
"""M3a: prova o nova_chave_arquivo.py. Uso: python3 ~/Workspace/forja/ferramentas/arquivo/teste_nova_chave_arquivo.py"""
import hashlib, os, re, subprocess, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
ALVO = os.path.join(AQUI, "nova_chave_arquivo.py")
falhas = []


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def roda(base, *args, env_extra=None):
    env = dict(os.environ)
    env.pop("ARQUIVO_BASE", None)
    if base is not None:
        env["ARQUIVO_BASE"] = base
    env.update(env_extra or {})
    return subprocess.run([sys.executable, ALVO] + list(args), capture_output=True, text=True, env=env, timeout=30)


def nova_base(modo=0o700, cria=True):
    b = tempfile.mkdtemp(prefix="novachave-")
    if cria:
        os.mkdir(os.path.join(b, "chaves"), modo)
        os.chmod(os.path.join(b, "chaves"), modo)
    return b


# --- caminho feliz ---
b = nova_base()
r = roda(b, "copiador")
alvo = os.path.join(b, "chaves", "copiador.chave")
exige(r.returncode == 0, "feliz: sai 0 (%s)" % r.stderr.strip())
exige(re.fullmatch(r"[0-9a-f]{64}\n", r.stdout) is not None, "feliz: stdout é só o sha256")
conteudo = open(alvo, encoding="utf-8").read() if os.path.exists(alvo) else ""
exige(conteudo.startswith("forja_") and conteudo.endswith("\n") and conteudo.count("\n") == 1, "feliz: arquivo tem forja_... e uma linha")
exige(hashlib.sha256(conteudo.strip().encode()).hexdigest() == r.stdout.strip(), "feliz: o sha256 é o da chave gravada")
exige(os.path.exists(alvo) and (os.stat(alvo).st_mode & 0o777) == 0o600, "feliz: arquivo em 0600")
exige(conteudo.strip() not in r.stdout + r.stderr, "feliz: a chave nunca sai na tela")

# --- repetir: não sobrescreve e devolve o mesmo hash ---
r2 = roda(b, "copiador")
exige(r2.returncode == 0 and r2.stdout == r.stdout, "repetir: mesmo hash, saída 0")
exige(open(alvo, encoding="utf-8").read() == conteudo, "repetir: arquivo intacto")

# --- os três programas têm chaves diferentes ---
h = {p: roda(b, p).stdout for p in ("respondedor", "conferidor")}
exige(len({r.stdout, h["respondedor"], h["conferidor"]}) == 3, "três programas, três chaves")

# --- formas recusadas ---
for args in ([], ["fila"], ["copiador", "extra"], ["../copiador"]):
    rr = roda(b, *args)
    exige(rr.returncode == 2 and rr.stdout == "", "recusa %r" % (args,))

# --- pasta ausente ou aberta: não grava ---
b2 = nova_base(cria=False)
rr = roda(b2, "copiador")
exige(rr.returncode == 2 and not os.path.exists(os.path.join(b2, "chaves")), "sem chaves/: recusa e não cria")
b3 = nova_base(modo=0o755)
rr = roda(b3, "copiador")
exige(rr.returncode == 2 and os.listdir(os.path.join(b3, "chaves")) == [], "chaves/ em 755: recusa sem gravar")

# --- arquivo existente com permissão aberta: recusa (não devolve hash de chave exposta) ---
b4 = nova_base()
p4 = os.path.join(b4, "chaves", "copiador.chave")
with open(p4, "w") as f:
    f.write("forja_x\n")
os.chmod(p4, 0o644)
rr = roda(b4, "copiador")
exige(rr.returncode == 2 and rr.stdout == "", "chave existente em 644: recusa")

# --- variável apagada: o padrão é /opt/arquivo (regra do env com fallback) ---
env = dict(os.environ)
env.pop("ARQUIVO_BASE", None)
rp = subprocess.run([sys.executable, "-c", "import nova_chave_arquivo as n; print(n.caminho('copiador'))"],
                    cwd=AQUI, capture_output=True, text=True, env=env, timeout=30)
exige(rp.stdout.strip() == "/opt/arquivo/chaves/copiador.chave", "ARQUIVO_BASE apagada: /opt/arquivo/chaves/copiador.chave")

print("\nnova_chave_arquivo: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_nova_chave_arquivo.py`
Expected: várias `FALHA` (o script não existe), saída 1.

- [ ] **Step 3: Escrever o gerador**

`arquivo/nova_chave_arquivo.py`:

```python
"""M3a: chave de API de um programa do arquivo, gerada NA FORJA e gravada em
<ARQUIVO_BASE>/chaves/<programa>.chave (0600), sem nunca imprimir o valor.
Imprime só o SHA-256, que vai para o banco pelo seed_chave_forja.sh <programa> <sha256>, no Mac.

Uso, na forja:  python3 /opt/arquivo/ferramentas/nova_chave_arquivo.py copiador|respondedor|conferidor

Se a chave já existe, não gera outra: devolve o hash da existente (repetir o bloco depois de parar no meio
não troca chave). Trocar chave é rotação, e rotação não é da M3a (RUNBOOK-rollback-e-referencia.md).
Importar este módulo não lê nem grava nada."""
import hashlib, os, secrets, sys

PROGRAMAS = ("copiador", "respondedor", "conferidor")


def base():
    return os.environ.get("ARQUIVO_BASE") or "/opt/arquivo"


def caminho(programa):
    return os.path.join(base(), "chaves", programa + ".chave")


def _hash(chave):
    return hashlib.sha256(chave.encode()).hexdigest()


def pare(msg):
    print("pare: " + msg, file=sys.stderr)
    return 2


def main(argv):
    if len(argv) != 2 or argv[1] not in PROGRAMAS:
        return pare("uso: nova_chave_arquivo.py copiador|respondedor|conferidor")
    pasta = os.path.join(base(), "chaves")
    if not os.path.isdir(pasta):
        return pare("%s não existe (o instalar-casa-forja.sh a cria)" % pasta)
    if os.stat(pasta).st_mode & 0o077:
        return pare("%s está aberta (%o); tem de ser 700" % (pasta, os.stat(pasta).st_mode & 0o777))
    alvo = caminho(argv[1])
    if os.path.exists(alvo):
        if os.stat(alvo).st_mode & 0o077:
            return pare("%s está aberta (%o); tem de ser 600. Trate como chave exposta (runbook)"
                        % (alvo, os.stat(alvo).st_mode & 0o777))
        chave = open(alvo, encoding="utf-8").read().strip()
        if not chave.startswith("forja_"):
            return pare("%s não tem uma chave forja_..." % alvo)
        print(_hash(chave))
        return 0
    chave = "forja_" + secrets.token_urlsafe(32)
    try:
        fd = os.open(alvo, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return pare("%s apareceu no meio; rode de novo" % alvo)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(chave + "\n")
        f.flush()
        os.fsync(f.fileno())
    print(_hash(chave))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_nova_chave_arquivo.py`
Expected: `nova_chave_arquivo: 0 falha(s)`.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/nova_chave_arquivo.py arquivo/teste_nova_chave_arquivo.py
git -C $K commit -m "feat: arquivo M3a, chave de API por programa gerada na forja (0600, nunca sobrescreve, imprime só o sha256)" -- arquivo/nova_chave_arquivo.py arquivo/teste_nova_chave_arquivo.py
```

---

### Task 4: Três modos novos no `seed_chave_forja.sh`, sem revogação

**Files:**
- Modify: `~/Workspace/forja/ferramentas/seed_chave_forja.sh:20-29` (formas aceitas), `:37-42` (`case`), `:49` (condição da pré-checagem), `:75-80` (decisão), `:126` e `:139-145` (conferência e fim)
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_seed_arquivo.sh`; regressão: `~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh`

**Interfaces:**
- Consumes: o sha256 impresso por `nova_chave_arquivo.py` (Tarefa 3).
- Produces: `bash seed_chave_forja.sh <copiador|respondedor|conferidor> <sha256>` grava `forja (arquivo copiador)` `{archive_copy}`, `forja (arquivo respondedor)` `{archive_read}`, `forja (arquivo conferidor)` `{archive_b2}`; idempotente pelo hash; **nunca revoga**; para antes de escrever se já houver outra chave ativa com o mesmo nome.

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_seed_arquivo.sh`:

```bash
#!/bin/bash
# M3a: prova os modos copiador, respondedor e conferidor do seed_chave_forja.sh, NO MAC e SEM TOCAR NO BANCO:
# um npx falso na frente do PATH guarda cada chamada e devolve o JSON de mentira de $FALSO_SAIDA.
# Uso: bash ~/Workspace/forja/ferramentas/arquivo/teste_seed_arquivo.sh
set -uo pipefail
AQUI=$(cd "$(dirname "$0")" && pwd)
ALVO="$AQUI/../seed_chave_forja.sh"
H1=$(printf 'c%.0s' $(seq 64))
RAIZ=$(mktemp -d); mkdir -p "$RAIZ/bin"
trap 'rm -rf "$RAIZ"' EXIT
cat > "$RAIZ/bin/npx" <<'FIM'
#!/bin/bash
N=$(( $(cat "$FALSO_N" 2>/dev/null || echo 0) + 1 )); echo "$N" > "$FALSO_N"
printf '%s' "${!#}" > "$FALSO_SQL.$N"
cat "$FALSO_SAIDA" 2>/dev/null || echo '[]'
FIM
chmod 755 "$RAIZ/bin/npx"
export PATH="$RAIZ/bin:$PATH"
export FALSO_N="$RAIZ/n" FALSO_SQL="$RAIZ/sql" FALSO_SAIDA="$RAIZ/saida.json"
falhas=0
ok() { if [ "$2" = ok ]; then echo "OK    $1"; else echo "FALHA $1 — ${3:-}"; falhas=$((falhas+1)); fi; }
roda() {   # roda <json> <args...>  -> RC, SAIDA, N
  printf '%s' "$1" > "$FALSO_SAIDA"; shift
  rm -f "$FALSO_N" "$FALSO_SQL".*
  SAIDA=$(bash "$ALVO" "$@" 2>&1); RC=$?
  N=$(cat "$FALSO_N" 2>/dev/null || echo 0)
}
sql() { cat "$FALSO_SQL.$1" 2>/dev/null; }
todas() { cat "$FALSO_SQL".* 2>/dev/null; }

for par in "copiador:arquivo copiador:archive_copy" "respondedor:arquivo respondedor:archive_read" "conferidor:arquivo conferidor:archive_b2"; do
  IFS=: read -r MODO ROT PERM <<< "$par"
  BOM="[{\"outras\":0,\"datas\":\"\",\"ativas\":1,\"minha\":1,\"perms\":\"$PERM\"}]"
  roda "$BOM" "$MODO" "$H1"
  [ "$RC" = 0 ] && ok "$MODO: sai 0" ok || ok "$MODO: sai 0" nao "rc=$RC :: $SAIDA"
  [ "$N" = 3 ] && ok "$MODO: pré-checagem + escrita + conferência" ok || ok "$MODO: três chamadas" nao "chamadas=$N"
  grep -qF -- "k.name = 'forja ($ROT)'" <<< "$(sql 1)" && ok "$MODO: pré-checagem pelo nome" ok || ok "$MODO: pré-checagem pelo nome" nao "$(sql 1)"
  grep -qF -- "'forja ($ROT)', '$H1', array['$PERM']" <<< "$(sql 2)" && ok "$MODO: insert com nome e permissão" ok || ok "$MODO: insert com nome e permissão" nao "$(sql 2)"
  grep -q "set revoked_at" <<< "$(todas)" && ok "$MODO: nunca revoga" nao "achou update" || ok "$MODO: nunca revoga" ok
  grep -qF "$H1" <<< "$SAIDA" && ok "$MODO: não mostra o hash" nao "mostrou" || ok "$MODO: não mostra o hash" ok

  # já existe outra chave ativa com o mesmo nome: para ANTES de escrever, mesmo com CONFIRMAR_REVOGACAO=sim
  OUTRA="[{\"outras\":1,\"datas\":\"2026-10-14\",\"ativas\":1,\"minha\":1,\"perms\":\"$PERM\"}]"
  roda "$OUTRA" "$MODO" "$H1"
  { [ "$RC" != 0 ] && [ "$N" = 1 ]; } && ok "$MODO: outra ativa para antes de escrever" ok || ok "$MODO: outra ativa para antes de escrever" nao "rc=$RC chamadas=$N"
  printf '%s' "$OUTRA" > "$FALSO_SAIDA"; rm -f "$FALSO_N" "$FALSO_SQL".*
  SAIDA=$(CONFIRMAR_REVOGACAO=sim bash "$ALVO" "$MODO" "$H1" 2>&1); RC=$?; N=$(cat "$FALSO_N" 2>/dev/null || echo 0)
  { [ "$RC" != 0 ] && [ "$N" = 1 ]; } && ok "$MODO: CONFIRMAR_REVOGACAO não abre revogação" ok || ok "$MODO: CONFIRMAR_REVOGACAO não abre revogação" nao "rc=$RC chamadas=$N"

  roda "[{\"outras\":0,\"ativas\":1,\"minha\":1,\"perms\":\"read\"}]" "$MODO" "$H1"
  [ "$RC" != 0 ] && ok "$MODO: permissão diferente na conferência para" ok || ok "$MODO: permissão diferente na conferência para" nao "rc=$RC"
  roda "[{\"outras\":0,\"ativas\":2,\"minha\":1,\"perms\":\"$PERM\"}]" "$MODO" "$H1"
  [ "$RC" != 0 ] && ok "$MODO: duas ativas na conferência param" ok || ok "$MODO: duas ativas na conferência param" nao "rc=$RC"
  roda "$BOM" "$MODO" "zzz"
  { [ "$RC" != 0 ] && [ "$N" = 0 ]; } && ok "$MODO: hash inválido não chega ao banco" ok || ok "$MODO: hash inválido não chega ao banco" nao "rc=$RC chamadas=$N"
done

echo; echo "seed arquivo: $falhas falha(s)"; [ "$falhas" = 0 ]
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bash ~/Workspace/forja/ferramentas/arquivo/teste_seed_arquivo.sh`
Expected: `FALHA copiador: sai 0` (o script responde "formas aceitas"), linha final com falhas, saída 1.

- [ ] **Step 3: Alterar o `seed_chave_forja.sh`**

3a. Cabeçalho (linhas 5-7), acrescentar depois da linha do modo `fila`:

```bash
#   bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh copiador <sha256>     # arquivo (M3a) -> {archive_copy}
#   bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh respondedor <sha256>  # arquivo (M3a) -> {archive_read}
#   bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh conferidor <sha256>   # arquivo (M3a) -> {archive_b2}
# Os modos do arquivo NUNCA revogam: se ja houver outra chave ativa com o mesmo nome, param antes de escrever.
```

3b. Trocar o bloco de formas aceitas (linhas 20-29) por:

```bash
if [ "${1:-}" = fila ]; then
  MODO=fila; H="${2:-}"
elif [[ "${1:-}" =~ ^(copiador|respondedor|conferidor)$ ]]; then
  MODO="$1"; H="${2:-}"
elif [[ "${1:-}" =~ ^[0-9a-f]{64}$ ]]; then
  MODO=leitura; H="$1"
else
  echo "pare: formas aceitas:" >&2
  echo "        seed_chave_forja.sh <sha256>              (forja so leitura, {read})" >&2
  echo "        seed_chave_forja.sh fila <sha256>         (forja fila, {intelligence})" >&2
  echo "        seed_chave_forja.sh copiador <sha256>     (arquivo, {archive_copy})" >&2
  echo "        seed_chave_forja.sh respondedor <sha256>  (arquivo, {archive_read})" >&2
  echo "        seed_chave_forja.sh conferidor <sha256>   (arquivo, {archive_b2})" >&2
  exit 1
fi
```

3c. No `case` (linhas 38-42), acrescentar antes de `*)`:

```bash
  copiador)    NOME='forja (arquivo copiador)';    ROTULO='arquivo copiador';    PERMS="array['archive_copy']"; CANON='archive_copy' ;;
  respondedor) NOME='forja (arquivo respondedor)'; ROTULO='arquivo respondedor'; PERMS="array['archive_read']"; CANON='archive_read' ;;
  conferidor)  NOME='forja (arquivo conferidor)';  ROTULO='arquivo conferidor';  PERMS="array['archive_b2']";   CANON='archive_b2' ;;
```

3d. A pré-checagem passa a valer para todo modo que não é o de leitura. Linha 49: `if [ "$MODO" = fila ]; then` vira `if [ "$MODO" != leitura ]; then`. E a decisão (linhas 75-80) vira:

```bash
  if [ "${OUTRAS:-0}" -gt 0 ] && [ "$MODO" != fila ]; then
    pare "ja existe $OUTRAS chave(s) '$NOME' ativa(s) neste site (criada(s) em: $DATAS). Nada foi alterado.
      Este modo nunca revoga: trocar a chave do arquivo e rotacao, pelo RUNBOOK-rollback-e-referencia.md da manutencao-nas."
  fi
  if [ "${OUTRAS:-0}" -gt 0 ] && [ "${CONFIRMAR_REVOGACAO:-}" != "sim" ]; then
    pare "isto revogaria $OUTRAS chave(s) '$NOME' que ja estao ativa(s) neste site (criada(s) em: $DATAS). Nada foi alterado ainda.
      Se isto e uma rotacao intencional, rode de novo com CONFIRMAR_REVOGACAO=sim bash seed_chave_forja.sh fila <sha>.
      Se voce nao esperava isto, o SHA passado pode estar errado (por exemplo o da fase 1) — confira antes de continuar."
  fi
```

(O texto da segunda mensagem é o de hoje, sem mudança.)

3e. Na conferência em Python (linha 139), `if modo == "fila" and int(r.get("ativas") or 0) != 1:` vira `if modo != "leitura" and int(r.get("ativas") or 0) != 1:` e a mensagem passa a `"pare: sobrou mais de uma %s ativa no site (%s) — revogue a mao antes de seguir" % (sys.argv[3], r.get("ativas"))`, com `"$NOME"` acrescentado como terceiro argumento na linha que chama o Python (`' "$MODO" "$CANON" "$NOME"`).

3f. No fim (linhas 141-146), acrescentar antes do `if [ "$MODO" = fila ]`:

```bash
case "$MODO" in
  copiador|respondedor|conferidor) echo "Proximo: a conferencia CP5 do m3a-8-chaves.sh (as chaves do arquivo nao escrevem nada ate a M3b)"; exit 0 ;;
esac
```

- [ ] **Step 4: Rodar os dois testes**

Run: `bash ~/Workspace/forja/ferramentas/arquivo/teste_seed_arquivo.sh && bash ~/Workspace/forja/ferramentas/fase2/teste_seed_fila.sh && bash -n ~/Workspace/forja/ferramentas/seed_chave_forja.sh && echo SINTAXE-OK`
Expected: `seed arquivo: 0 falha(s)`, o teste da fila sem nenhuma `FALHA` (o SQL da fase 1 e o da fila continuam byte a byte iguais) e `SINTAXE-OK`.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- seed_chave_forja.sh arquivo/teste_seed_arquivo.sh
git -C $K commit -m "feat: seed das chaves do arquivo (copiador, respondedor, conferidor), sem revogacao e parando se ja houver outra ativa" -- seed_chave_forja.sh arquivo/teste_seed_arquivo.sh
```

---

### Task 5: `configurar_rclone.py`, a chave da cifra na forja a partir do cofre

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/configurar_rclone.py`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_configurar_rclone.py`

**Interfaces:**
- Consumes: `rclone` 1.60 ou maior no PATH (Tarefa 2).
- Produces: `main(argv, perguntar=input, segredo=getpass.getpass) -> int`; `caminho_conf() -> str` (padrão `~/.config/rclone/rclone.conf`, trocável por `RCLONE_CONFIG`). Escreve os remotos `b2arq` (tipo `b2`) e `arq` (tipo `crypt`, `remote = b2arq:<bucket>/<pasta>`, `filename_encryption = off`), pasta `0700`, arquivo `0600`. Uso: `ssh -t forja 'python3 /opt/arquivo/ferramentas/configurar_rclone.py'` (com `--trocar` para reescrever).

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_configurar_rclone.py`:

```python
"""M3a: prova o configurar_rclone.py com um rclone FALSO no PATH (nenhum B2 é tocado).
Uso: python3 ~/Workspace/forja/ferramentas/arquivo/teste_configurar_rclone.py"""
import os, stat, sys, tempfile, io, contextlib

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import configurar_rclone as cr  # noqa: E402

falhas = []
SENHA, SAL, CHAVE = "senha-do-cofre-123", "sal-do-cofre-456", "K005abcdefghijklmnopqrstuvwxyz0"
CONTA, BUCKET, PASTA = "005a1b2c3d4e5f60000000001", "tnf-site-arquivo-7q2", "site-arquivo"


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


FALSO = r'''#!/bin/sh
echo "$*" >> "@T@/argv"
case "$1" in
  version) echo "rclone @VERSAO@";;
  obscure) IFS= read -r v
           @ENTRADA@ | python3 -c 'import base64,sys; print(base64.urlsafe_b64encode(b"\0"*16+sys.stdin.buffer.read()).decode().rstrip("="))';;
  listremotes) @LISTAR@;;
esac
'''


def ambiente(versao="v1.60.1-DEV", sem_rclone=False, lista_quebrada=False, obscure_ignora_entrada=False):
    t = tempfile.mkdtemp(prefix="cfgrclone-")
    os.mkdir(os.path.join(t, "bin"))
    if not sem_rclone:
        listar = "echo b2arq:" if lista_quebrada else \
            "grep -E '^\\[[a-z0-9]+\\]$' \"$RCLONE_CONFIG\" | tr -d '[]' | sed 's/$/:/'"
        entrada = "printf '%s' -" if obscure_ignora_entrada else "printf '%s' \"$v\""
        corpo = (FALSO.replace("@T@", t).replace("@VERSAO@", versao)
                 .replace("@ENTRADA@", entrada).replace("@LISTAR@", listar))
        with open(os.path.join(t, "bin", "rclone"), "w") as f:
            f.write(corpo)
        os.chmod(os.path.join(t, "bin", "rclone"), 0o755)
    os.environ["PATH"] = os.path.join(t, "bin") + os.pathsep + "/usr/bin:/bin"
    os.environ["RCLONE_CONFIG"] = os.path.join(t, "cfg", "rclone", "rclone.conf")
    return t


def respostas(*vals):
    it = iter(vals)
    return lambda _prompt="": next(it)


def nunca(_prompt=""):
    raise AssertionError("não devia perguntar")


def roda(argv, perguntar, segredo):
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        rc = cr.main(["configurar_rclone.py"] + argv, perguntar=perguntar, segredo=segredo)
    return rc, out.getvalue()


def obs(v):
    import base64
    return base64.urlsafe_b64encode(b"\0" * 16 + v.encode()).decode().rstrip("=")


# --- caminho feliz ---
t = ambiente()
rc, saida = roda([], respostas(BUCKET, PASTA, CONTA), respostas(CHAVE, SENHA, SAL))
conf = os.environ["RCLONE_CONFIG"]
texto = open(conf).read() if os.path.exists(conf) else ""
exige(rc == 0, "feliz: sai 0 (%s)" % saida.strip())
exige("[b2arq]\ntype = b2\naccount = %s\nkey = %s\nhard_delete = false\n" % (CONTA, CHAVE) in texto, "feliz: remoto b2arq")
exige("[arq]\ntype = crypt\nremote = b2arq:%s/%s\nfilename_encryption = off\ndirectory_name_encryption = false\npassword = %s\npassword2 = %s\n"
      % (BUCKET, PASTA, obs(SENHA), obs(SAL)) in texto, "feliz: remoto arq com senha e sal obscurecidos")
exige(stat.S_IMODE(os.stat(conf).st_mode) == 0o600, "feliz: arquivo 0600")
exige(stat.S_IMODE(os.stat(os.path.dirname(conf)).st_mode) == 0o700, "feliz: pasta 0700")
argv_log = open(os.path.join(t, "argv")).read()
exige(all(s not in argv_log for s in (SENHA, SAL, CHAVE)), "feliz: nenhum segredo em argumento de processo")
exige(all(s not in saida for s in (SENHA, SAL, CHAVE)), "feliz: nenhum segredo na tela")

# --- já existe: recusa antes de perguntar qualquer coisa ---
rc, saida = roda([], nunca, nunca)
exige(rc == 2 and open(conf).read() == texto, "existente sem --trocar: recusa e não toca")

# --- --trocar reescreve ---
rc, _ = roda(["--trocar"], respostas(BUCKET, PASTA, CONTA), respostas(CHAVE, "outra-senha", SAL))
exige(rc == 0 and obs("outra-senha") in open(conf).read(), "--trocar: reescreve")

# --- --trocar com a lista quebrada: a configuração boa fica intacta (valida o temporário antes de trocar) ---
bom = open(conf).read()
ambiente(lista_quebrada=True)
os.environ["RCLONE_CONFIG"] = conf
rc, _ = roda(["--trocar"], respostas(BUCKET, PASTA, CONTA), respostas(CHAVE, "senha-nova", SAL))
exige(rc == 2 and open(conf).read() == bom, "--trocar com lista quebrada: rc 2 e a configuração anterior intacta")

# --- obscure que ignora a entrada padrão (obscurece o texto "-"): recusa sem gravar ---
ambiente(obscure_ignora_entrada=True)
rc, _ = roda([], respostas(BUCKET, PASTA, CONTA), respostas(CHAVE, SENHA, SAL))
exige(rc == 2 and not os.path.exists(os.environ["RCLONE_CONFIG"]), "obscure que ignora a entrada: recusa sem gravar")

# --- rclone velho, ausente ou ilegível: recusa sem perguntar e sem gravar ---
for nome, kw in (("1.59", {"versao": "v1.59.2"}), ("ausente", {"sem_rclone": True}), ("ilegível", {"versao": "x"})):
    ambiente(**kw)
    rc, _ = roda([], nunca, nunca)
    exige(rc == 2 and not os.path.exists(os.environ["RCLONE_CONFIG"]), "rclone %s: recusa sem gravar" % nome)

# --- entradas fora do formato: recusa sem gravar ---
for nome, perg, seg in (
        ("bucket", respostas("Tnf_Arquivo", PASTA, CONTA), respostas(CHAVE, SENHA, SAL)),
        ("pasta com barra", respostas(BUCKET, "a/b", CONTA), respostas(CHAVE, SENHA, SAL)),
        ("conta", respostas(BUCKET, PASTA, "xyz"), respostas(CHAVE, SENHA, SAL)),
        ("chave curta", respostas(BUCKET, PASTA, CONTA), respostas("K1", SENHA, SAL)),
        ("senha vazia", respostas(BUCKET, PASTA, CONTA), respostas(CHAVE, "", SAL)),
        ("sal vazio", respostas(BUCKET, PASTA, CONTA), respostas(CHAVE, SENHA, ""))):
    ambiente()
    rc, saida = roda([], perg, seg)
    exige(rc == 2 and not os.path.exists(os.environ["RCLONE_CONFIG"]), "%s: recusa sem gravar" % nome)

# --- o rclone não enxerga os dois remotos: apaga o que gravou e para ---
ambiente(lista_quebrada=True)
rc, _ = roda([], respostas(BUCKET, PASTA, CONTA), respostas(CHAVE, SENHA, SAL))
exige(rc == 2 and not os.path.exists(os.environ["RCLONE_CONFIG"]), "listremotes sem arq: apaga e para")

# --- RCLONE_CONFIG apagada: o padrão é ~/.config/rclone/rclone.conf ---
os.environ.pop("RCLONE_CONFIG", None)
casa = tempfile.mkdtemp(prefix="cfgcasa-")
os.environ["HOME"] = casa
exige(cr.caminho_conf() == os.path.join(casa, ".config", "rclone", "rclone.conf"), "RCLONE_CONFIG apagada: ~/.config/rclone/rclone.conf")

print("\nconfigurar_rclone: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_configurar_rclone.py`
Expected: `ModuleNotFoundError: No module named 'configurar_rclone'`, saída 1.

- [ ] **Step 3: Escrever o configurador**

`arquivo/configurar_rclone.py`:

```python
"""M3a: escreve na forja a configuração do rclone para LER o arquivo no B2 (spec 02 §10.9, §11.1).
Remotos: b2arq (B2 cru, com a chave SÓ DE LEITURA da forja) e arq (crypt sobre b2arq:<bucket>/<pasta>).
A senha e o sal da cifra vêm do COFRE, nunca do TrueNAS: decifrar na forja prova que o cofre e o TrueNAS
têm a mesma chave. Os segredos são digitados (getpass) e obscurecidos pela entrada padrão do rclone:
nunca passam por argumento de processo, por arquivo do kit nem pela tela.

Uso, na forja:  python3 /opt/arquivo/ferramentas/configurar_rclone.py [--trocar]
Sem --trocar, recusa se a configuração já existir (antes de perguntar qualquer coisa)."""
import getpass, os, re, subprocess, sys, tempfile

RE_BUCKET = re.compile(r"^[a-z0-9][a-z0-9-]{4,48}[a-z0-9]$")
RE_PASTA = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
RE_CONTA = re.compile(r"^[0-9a-f]{12,40}$")          # keyID do B2 (hex); faixa larga: o tamanho exato NÃO VERIFICADO
RE_CHAVE = re.compile(r"^[A-Za-z0-9+/=_-]{20,100}$")  # applicationKey do B2; formato exato NÃO VERIFICADO

MODELO = """[b2arq]
type = b2
account = {conta}
key = {chave}
hard_delete = false

[arq]
type = crypt
remote = b2arq:{bucket}/{pasta}
filename_encryption = off
directory_name_encryption = false
password = {senha}
password2 = {sal}
"""


def caminho_conf():
    return os.environ.get("RCLONE_CONFIG") or os.path.join(os.path.expanduser("~"), ".config", "rclone", "rclone.conf")


def pare(msg):
    print("pare: " + msg, file=sys.stderr)
    return 2


def versao_ok():
    try:
        r = subprocess.run(["rclone", "version"], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return False, "rclone ausente"
    linha = (r.stdout.splitlines() or [""])[0]
    m = re.match(r"rclone v(\d+)\.(\d+)", linha)
    if not m:
        return False, "versão ilegível: %r" % linha
    return (int(m.group(1)), int(m.group(2))) >= (1, 60), linha


def obscurecer(valor):
    r = subprocess.run(["rclone", "obscure", "-"], input=valor + "\n", capture_output=True, text=True, timeout=60)
    saida = r.stdout.strip()
    if r.returncode != 0 or not saida or "\n" in saida:
        raise RuntimeError("rclone obscure falhou (código %d)" % r.returncode)
    # O valor obscurecido é base64url de 16 bytes de IV mais o texto: prova que a entrada padrão foi lida
    # (um rclone que tomasse "-" como o valor devolveria uma linha não vazia e passaria na checagem acima).
    import base64
    try:
        bruto = base64.urlsafe_b64decode(saida + "=" * (-len(saida) % 4))
    except ValueError:
        raise RuntimeError("rclone obscure devolveu algo que não é base64")
    if len(bruto) != 16 + len(valor.encode("utf-8")):
        raise RuntimeError("rclone obscure não leu o valor da entrada padrão")
    return saida


def main(argv, perguntar=input, segredo=getpass.getpass):
    trocar = argv[1:] == ["--trocar"]
    if argv[1:] not in ([], ["--trocar"]):
        return pare("uso: configurar_rclone.py [--trocar]")
    alvo = caminho_conf()
    if os.path.exists(alvo) and not trocar:
        return pare("%s já existe; nada foi perguntado nem gravado. Para reescrever: --trocar" % alvo)
    ok, linha = versao_ok()
    if not ok:
        return pare("rclone 1.60 ou maior é exigido (%s)" % linha)

    bucket = perguntar("Bucket do arquivo no B2: ").strip()
    pasta = perguntar("Pasta dentro do bucket (site-arquivo): ").strip()
    conta = perguntar("keyID da chave de LEITURA da forja: ").strip()
    chave = segredo("applicationKey dessa chave (não aparece): ").strip()
    senha = segredo("Senha da cifra, copiada do COFRE (não aparece): ")
    sal = segredo("Sal da cifra, copiado do COFRE (não aparece): ")
    for nome, valor, regra in (("bucket", bucket, RE_BUCKET), ("pasta", pasta, RE_PASTA),
                               ("keyID", conta, RE_CONTA), ("applicationKey", chave, RE_CHAVE)):
        if not regra.match(valor):
            return pare("%s fora do formato; nada foi gravado" % nome)
    if not senha or not sal:
        return pare("senha e sal são obrigatórios (os dois estão no cofre); nada foi gravado")
    try:
        conteudo = MODELO.format(conta=conta, chave=chave, bucket=bucket, pasta=pasta,
                                 senha=obscurecer(senha), sal=obscurecer(sal))
    except RuntimeError as e:
        return pare("%s; nada foi gravado" % e)

    pasta_conf = os.path.dirname(alvo)
    os.makedirs(pasta_conf, mode=0o700, exist_ok=True)
    os.chmod(pasta_conf, 0o700)
    fd, tmp = tempfile.mkstemp(prefix=".rclone.conf.", dir=pasta_conf)
    try:
        os.chmod(tmp, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(conteudo)
            f.flush()
            os.fsync(f.fileno())
        # Valida o TEMPORÁRIO antes de trocar: com --trocar, uma entrada ruim nunca apaga a configuração que funcionava.
        r = subprocess.run(["rclone", "listremotes"], capture_output=True, text=True, timeout=60,
                           env=dict(os.environ, RCLONE_CONFIG=tmp))
        remotos = set(r.stdout.split())
        if r.returncode != 0 or not {"b2arq:", "arq:"} <= remotos:
            os.remove(tmp)
            return pare("o rclone não enxerga b2arq: e arq: (%s); a configuração anterior ficou intacta" % " ".join(sorted(remotos)))
        os.replace(tmp, alvo)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    print("ok: %s (0600), remotos b2arq: e arq:. Próximo: m3a-10-prova-b2.sh (só leitura)." % alvo)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_configurar_rclone.py`
Expected: `configurar_rclone: 0 falha(s)`.

Também rodar de novo o teste da Tarefa 2 (ele copia este arquivo): `bash ~/Workspace/forja/ferramentas/arquivo/teste_instalar_casa.sh` → `instalar-casa: 0 falha(s)`.

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/configurar_rclone.py arquivo/teste_configurar_rclone.py
git -C $K commit -m "feat: arquivo M3a, rclone da forja configurado a partir do cofre (getpass, obscure pela entrada padrao, 0600/0700)" -- arquivo/configurar_rclone.py arquivo/teste_configurar_rclone.py
```

---

### Task 6: Os três blocos do `pulso.sh` e o instalador (instalação na M3b)

**Files:**
- Create: `~/Workspace/forja/ferramentas/arquivo/pulso_arquivo.py`
- Test: `~/Workspace/forja/ferramentas/arquivo/teste_pulso_arquivo.py`

**Interfaces:**
- Consumes: o `pulso.sh` vivo (âncora `[ "$ok" -eq 1 ]`, variável `motivo`), no dia da M3b.
- Produces: `BLOCOS: dict[str, str]` com as chaves `copiador`, `conferir_b2`, `pulso_arquivo`; `abre(nome) -> str`, `fecha(nome) -> str`; `main(argv) -> int` (`<url copiador> <url conferência do B2> <url pulso>` ou `--remover`, grava `pulso.sh.tmp`). Contratos lidos: os três da seção "Interfaces registradas para a M3b".

- [ ] **Step 1: Escrever o teste que falha**

`arquivo/teste_pulso_arquivo.py`:

```python
"""M3a: prova os três blocos de vigilância do arquivo e o pulso_arquivo.py que os insere.
Uso (no Mac):                     python3 ~/Workspace/forja/ferramentas/arquivo/teste_pulso_arquivo.py
Uso (na M3b, no dia de instalar): python3 teste_pulso_arquivo.py pulso.sh.tmp   (confere também os blocos do arquivo)
Não toca no pulso vivo e não chama a rede: curl e sleep falsos no PATH, URLs de teste."""
import json, os, re, shutil, subprocess, sys, tempfile
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pulso_arquivo as pa  # noqa: E402

falhas = []
U_PRINC = "https://hc-ping.com/11111111-1111-1111-1111-111111111111"
U_FILA = "https://hc-ping.com/22222222-2222-2222-2222-222222222222"
U = {"copiador": "https://hc-ping.com/33333333-3333-3333-3333-333333333333",
     "conferir_b2": "https://hc-ping.com/44444444-4444-4444-4444-444444444444",
     "pulso_arquivo": "https://hc-ping.com/55555555-5555-5555-5555-555555555555"}
VAR_LOG = {"copiador": "ARQ_COPIADOR_LOG", "conferir_b2": "ARQ_B2_LOG", "pulso_arquivo": "ARQ_PLANO"}
BASE = ('#!/bin/bash\nURL="%s"\nok=1\nmotivo=""\n# >>> fila_intel (F4)\nURL_FILA="%s"\nok_fila=1\n'
        '# <<< fila_intel (F4)\n[ "$ok" -eq 1 ] && alvo="$URL" || alvo="$URL/fail"\nexit 0\n') % (U_PRINC, U_FILA)
AGORA = datetime.now().astimezone()


def exige(ok, nome):
    print("OK   " if ok else "FALHA", nome)
    if not ok:
        falhas.append(nome)


def roda(nome, caminho):
    tmp = tempfile.mkdtemp(prefix="pulsoarq-")
    binario = os.path.join(tmp, "bin")
    os.mkdir(binario)
    reg = os.path.join(tmp, "chamadas.txt")
    for prog in ("curl", "sleep"):
        p = os.path.join(binario, prog)
        with open(p, "w") as f:
            f.write('#!/bin/sh\necho "%s $*" >> %s\nexit 0\n' % (prog, reg))
        os.chmod(p, 0o755)
    script = os.path.join(tmp, "prova.sh")
    bloco = pa.BLOCOS[nome].replace("@URL@", U[nome])
    with open(script, "w") as f:
        f.write('ok=1\nok_fila=1\nmotivo=""\n' + bloco +
                'printf \'OK=%s OK_FILA=%s MOTIVO=%s\\n\' "$ok" "$ok_fila" "$motivo"\n')
    env = dict(os.environ, PATH=binario + os.pathsep + os.environ["PATH"])
    env[VAR_LOG[nome]] = caminho
    r = subprocess.run(["bash", script], env=env, capture_output=True, text=True, timeout=300)
    chamadas = open(reg).read().splitlines() if os.path.exists(reg) else []
    m = re.search(r"(?m)^OK=(\S*) OK_FILA=(\S*) MOTIVO=(.*)$", r.stdout)
    return (m.groups() if m else (None, None, None)), chamadas


def caso(nome, rotulo, caminho, esperado=None, padrao=None):
    (ok, ok_fila, motivo), chamadas = roda(nome, caminho)
    curls = [c for c in chamadas if c.startswith("curl ")]
    alvo = curls[-1].split()[-1] if curls else ""
    verde = esperado == ""
    exige(ok == "1" and ok_fila == "1", "%s/%s: não toca em ok nem em ok_fila" % (nome, rotulo))
    if padrao:
        exige(motivo is not None and re.match("^ " + padrao + "$", motivo), "%s/%s: motivo %r casa %s" % (nome, rotulo, motivo, padrao))
    else:
        exige(motivo == ("" if verde else " " + esperado), "%s/%s: motivo %r" % (nome, rotulo, motivo))
    exige(len(curls) == 1 and alvo == (U[nome] if verde else U[nome] + "/fail"), "%s/%s: um ping só, na verificação própria" % (nome, rotulo))
    exige(all(u not in "\n".join(chamadas) for u in (U_PRINC, U_FILA)), "%s/%s: nunca a principal nem a da fila" % (nome, rotulo))


FIX = tempfile.mkdtemp(prefix="pulsoarq-fix-")


def jsonl(nome_arq, linhas, cauda=""):
    p = os.path.join(FIX, nome_arq)
    with open(p, "w") as f:
        for d in linhas:
            f.write(json.dumps(d) + "\n")
        f.write(cauda)
    return p


def lin(horas, desfecho="ok", modo="cron"):
    return {"quando": (AGORA - timedelta(hours=horas)).isoformat(timespec="seconds"), "modo": modo, "desfecho": desfecho}


def plano(nome_arq, conteudo):
    p = os.path.join(FIX, nome_arq)
    with open(p, "w") as f:
        f.write(conteudo if isinstance(conteudo, str) else json.dumps(conteudo))
    return p


def obtido(horas):
    return (AGORA - timedelta(hours=horas)).isoformat(timespec="seconds")


# ---------- copiador (12 h entre execuções; parado acima de 13 h 30) ----------
C = "copiador"
caso(C, "ausente", os.path.join(FIX, "nao-existe.jsonl"), "arquivo-copiador-jsonl-ausente")
caso(C, "ok-recente", jsonl("c1.jsonl", [lin(12.5, "nas_fora"), lin(0.5)]), "")
caso(C, "ok-13h", jsonl("c2.jsonl", [lin(13)]), "")
caso(C, "parado-14h", jsonl("c3.jsonl", [lin(14)]), padrao=r"arquivo-copiador-parado-\d+s")
caso(C, "nas_fora", jsonl("c4.jsonl", [lin(12), lin(1, "nas_fora")]), "arquivo-copiador-nas_fora")
caso(C, "prova-nao-renova", jsonl("c5.jsonl", [lin(14), lin(0.2, "ok", "prova")]), padrao=r"arquivo-copiador-parado-\d+s")
caso(C, "ordem-por-quando", jsonl("c6.jsonl", [lin(1, "nas_cheio"), lin(12)]), "arquivo-copiador-nas_cheio")
caso(C, "cauda-sem-fim-de-linha", jsonl("c7.jsonl", [lin(1)], cauda='{"quando": "x", "modo": "cron", "desfecho": "erro"'), "")
caso(C, "linha-ilegivel", jsonl("c8.jsonl", [lin(1)], cauda="lixo\n"), "")
caso(C, "sem-cron", jsonl("c9.jsonl", [lin(1, "ok", "prova")]), "arquivo-copiador-sem-execucao")
caso(C, "quando-no-futuro", jsonl("c10.jsonl", [lin(-2)]), "arquivo-copiador-quando-no-futuro")
caso(C, "desfecho-ausente", jsonl("c11.jsonl", [{"quando": obtido(1), "modo": "cron"}]), "arquivo-copiador-None")

# ---------- conferência do B2 (uma vez por dia; parada acima de 25 h 30) ----------
B = "conferir_b2"
caso(B, "ausente", os.path.join(FIX, "nao-existe-b2.jsonl"), "arquivo-b2-jsonl-ausente")
caso(B, "ok-20h", jsonl("b1.jsonl", [dict(lin(20), pedidos=2, informados=2)]), "")
caso(B, "ok-sem-contagem", jsonl("b1a.jsonl", [lin(20)]), "arquivo-b2-sem-contagem")
caso(B, "ok-informados-menor", jsonl("b1b.jsonl", [dict(lin(20), pedidos=3, informados=1)]), "arquivo-b2-incompleto")
caso(B, "parada-26h", jsonl("b2.jsonl", [lin(26)]), padrao=r"arquivo-b2-parado-\d+s")
caso(B, "controle_falhou", jsonl("b3.jsonl", [lin(30), lin(2, "controle_falhou")]), "arquivo-b2-controle_falhou")
caso(B, "desligado", jsonl("b4.jsonl", [lin(2, "desligado")]), "arquivo-b2-desligado")
caso(B, "chave_ausente", jsonl("b5.jsonl", [lin(2, "chave_ausente")]), "arquivo-b2-chave_ausente")
# Antes da primeira selagem não há mês para conferir: verde só com o estado explícito; sem ele, vermelho (falha em verde).
caso(B, "pedidos-zero-e-ok", jsonl("b6.jsonl", [dict(lin(20), pedidos=0, informados=0, estado="aguardando_primeira_selagem")]), "")
caso(B, "pedidos-zero-sem-estado", jsonl("b7.jsonl", [dict(lin(20), pedidos=0, informados=0)]), "arquivo-b2-pedidos-0-sem-estado")
caso(B, "pedidos-3-informados-0", jsonl("b8.jsonl", [dict(lin(20, "incompleto"), pedidos=3, informados=0)]), "arquivo-b2-incompleto")

# ---------- pulso do arquivo (plano com menos de 13 h e campo vermelhos) ----------
P = "pulso_arquivo"
caso(P, "ausente", os.path.join(FIX, "nao-existe.json"), "arquivo-plano-ausente")
caso(P, "verde", plano("p1.json", {"obtido_em": obtido(12.9), "vermelhos": []}), "")
caso(P, "14h", plano("p2.json", {"obtido_em": obtido(14), "vermelhos": []}), padrao=r"arquivo-plano-velho-\d+s")
caso(P, "13h-exatas", plano("p3.json", {"obtido_em": obtido(13.01), "vermelhos": []}), padrao=r"arquivo-plano-velho-\d+s")
caso(P, "vermelhos-nulo", plano("p4.json", {"obtido_em": obtido(1), "vermelhos": None}), "arquivo-plano-sem-vermelhos")
caso(P, "vermelhos-ausente", plano("p5.json", {"obtido_em": obtido(1)}), "arquivo-plano-sem-vermelhos")
caso(P, "vermelhos-texto", plano("p6.json", {"obtido_em": obtido(1), "vermelhos": "x"}), "arquivo-plano-sem-vermelhos")
caso(P, "um-vermelho", plano("p7.json", {"obtido_em": obtido(1), "vermelhos": ["mês descartado sem releitura há 46 dias"]}),
     "arquivo-vermelho:1:mês_descartado_sem_releitura_há_46_dias")
caso(P, "dois-vermelhos", plano("p8.json", {"obtido_em": obtido(1), "vermelhos": ["a b", "c"]}), "arquivo-vermelho:2:a_b")
caso(P, "json-quebrado", plano("p9.json", "{"), padrao=r"arquivo-plano-leitura-\w+")
caso(P, "lista", plano("p10.json", []), "arquivo-plano-formato")
caso(P, "sem-obtido_em", plano("p11.json", {"vermelhos": []}), "arquivo-plano-sem-hora")
caso(P, "obtido_em-no-futuro", plano("p12.json", {"obtido_em": obtido(-2), "vermelhos": []}), "arquivo-plano-no-futuro")

# ---------- o texto dos blocos ----------
for n, b in pa.BLOCOS.items():
    exige(re.search(r"(?m)^\s*ok=", b) is None and "ok_fila" not in b, "%s: não atribui ok nem ok_fila" % n)
    exige(all(s not in b for s in ("FILA_LOG", "URL_FILA", "fila_intel")), "%s: não usa nada da fila" % n)
    exige(pa.ANCORA not in b, "%s: não contém a âncora" % n)
    exige(b.startswith(pa.abre(n) + "\n") and b.rstrip("\n").endswith(pa.fecha(n)), "%s: entre os seus marcadores" % n)

# ---------- o instalador ----------
def instala(base, *args):
    tmp = tempfile.mkdtemp(prefix="pulsoarq-ida-")
    with open(os.path.join(tmp, "pulso.sh"), "w") as f:
        f.write(base)
    r = subprocess.run([sys.executable, os.path.join(AQUI, "pulso_arquivo.py")] + list(args), cwd=tmp,
                       capture_output=True, text=True, timeout=60)
    saida = os.path.join(tmp, "pulso.sh.tmp")
    return r, tmp, (open(saida).read() if os.path.exists(saida) else None)


urls = [U["copiador"], U["conferir_b2"], U["pulso_arquivo"]]
r1, tmp1, novo = instala(BASE, *urls)
exige(r1.returncode == 0 and novo is not None, "instalar: ok")
if novo:
    exige(novo.index("# <<< fila_intel (F4)") < novo.index(pa.abre("copiador")) < novo.index(pa.abre("conferir_b2"))
          < novo.index(pa.abre("pulso_arquivo")) < novo.index(pa.ANCORA), "instalar: depois da fila e antes da âncora")
    exige(subprocess.run(["bash", "-n", os.path.join(tmp1, "pulso.sh.tmp")]).returncode == 0, "instalar: bash -n passa")
    exige((os.stat(os.path.join(tmp1, "pulso.sh.tmp")).st_mode & 0o777) == 0o600, "instalar: pulso.sh.tmp em 0600")
    r2, _, volta = instala(novo, "--remover")
    exige(r2.returncode == 0 and volta == BASE, "instalar + --remover devolve o arquivo byte a byte")
    r3, _, nada = instala(novo, *urls)
    exige(r3.returncode != 0 and "PARE" in r3.stdout and nada is None, "segunda instalação recusa sem gravar")
for rotulo, args in (("url http", ["http://hc-ping.com/33333333-3333-3333-3333-333333333333"] + urls[1:]),
                     ("duas urls", urls[:2]),
                     ("url repetida", [urls[0], urls[0], urls[2]]),
                     ("url da fila", [U_FILA] + urls[1:]),
                     ("url principal", [urls[0], U_PRINC, urls[2]])):
    r, _, nada = instala(BASE, *args)
    exige(r.returncode != 0 and nada is None, "recusa %s sem gravar" % rotulo)
r, _, nada = instala(BASE.replace(pa.ANCORA, "true"), *urls)
exige(r.returncode != 0 and nada is None, "sem âncora: recusa")
r, _, nada = instala(BASE, "--remover")
exige(r.returncode != 0 and nada is None, "--remover sem blocos: recusa")

# ---------- dia da M3b: os blocos instalados são os deste arquivo ----------
if len(sys.argv) > 1:
    vivo = open(sys.argv[1]).read()
    for n in pa.NOMES:
        i, j = vivo.index(pa.abre(n)), vivo.index(pa.fecha(n)) + len(pa.fecha(n))
        trecho = re.sub(r'(?m)^(URL_ARQ_\w+)="[^"]*"$', r'\1="@URL@"', vivo[i:j] + "\n")
        exige(trecho == pa.BLOCOS[n], "%s: bloco instalado igual ao do kit" % n)

print("\npulso arquivo: %d falha(s)" % len(falhas))
raise SystemExit(1 if falhas else 0)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_pulso_arquivo.py`
Expected: `ModuleNotFoundError: No module named 'pulso_arquivo'`, saída 1.

- [ ] **Step 3: Escrever os blocos e o instalador**

`arquivo/pulso_arquivo.py`:

```python
"""M3a: os três blocos de vigilância do arquivo no pulso.sh (spec 02 §10.6 e §10.9), cada um com
verificação PRÓPRIA no healthchecks.io: copiador, conferência do B2 e pulso do arquivo.
Escritos e testados na M3a; INSTALADOS NA M3B, junto dos programas (antes disso falhariam de hora em hora).

Uso (no diretório do pulso.sh):
    python3 pulso_arquivo.py <url copiador> <url conferência do B2> <url pulso do arquivo>   -> pulso.sh.tmp COM os blocos
    python3 pulso_arquivo.py --remover                                                      -> pulso.sh.tmp SEM os blocos
Nunca escreve por cima do pulso.sh: quem troca é o dono, com chmod 755 + mv (como o pulso_f4.py)."""
import os, re, sys

ANCORA = '[ "$ok" -eq 1 ]'
RE_URL = re.compile(r"^https://hc-ping\.com/[0-9a-f-]{36}$")
RE_URL_NO_TEXTO = re.compile(r"https://hc-ping\.com/[0-9a-f-]{36}")
NOMES = ("copiador", "conferir_b2", "pulso_arquivo")


def abre(nome):
    return "# >>> arquivo_%s (M3a)" % nome


def fecha(nome):
    return "# <<< arquivo_%s (M3a)" % nome


# Molde dos dois blocos que leem um registro .jsonl. Fichas: @N@ (nome do bloco), @V@ (sufixo de variável),
# @LOGVAR@, @LOG@, @PREFIXO@, @IDADE@ (segundos) e @PORQUE@ (a conta da idade). @URL@ fica para o instalador.
_MOLDE_JSONL = r'''@ABRE@
URL_ARQ_@V@="@URL@"
# Verificação PRÓPRIA (spec 02 §10.6/§10.9): nunca a da fila nem a principal. Mexe só em ok_arq_@N@ e em $motivo.
# A idade vem do `quando` da última linha modo=cron, NUNCA do mtime: uma execução --prova à mão renova o
# arquivo sem que o cron tenha rodado. @PORQUE@
# Registro ausente, sem linha de cron ou com quando no futuro: falha. Só desfecho "ok" é verde.
@LOGVAR@="${@LOGVAR@:-@LOG@}"
arq_@N@=$(python3 - "$@LOGVAR@" <<'EOF' 2>/dev/null
import json, os, sys, time
from datetime import datetime

PREFIXO, IDADE_MAX = "@PREFIXO@", @IDADE@


def olhar(arq):
    if not os.path.exists(arq):
        return PREFIXO + "-jsonl-ausente"
    ultima = None
    with open(arq, encoding="utf-8") as f:
        for l in f:
            if not l.endswith("\n"):          # cauda sendo escrita: ignora
                continue
            try:
                d = json.loads(l)
                if d.get("modo") != "cron":
                    continue
                q = datetime.fromisoformat(d["quando"])
            except Exception:
                continue                      # linha ilegível não derruba o bloco
            if ultima is None or q.timestamp() >= ultima[0]:
                ultima = (q.timestamp(), d)
    if ultima is None:
        return PREFIXO + "-sem-execucao"
    idade = int(time.time() - ultima[0])
    if idade < -300:
        return PREFIXO + "-quando-no-futuro"
    if idade > IDADE_MAX:
        return "%s-parado-%ds" % (PREFIXO, idade)
    desfecho = ultima[1].get("desfecho")
    if desfecho != "ok":
        return "%s-%s" % (PREFIXO, desfecho)
    if PREFIXO == "arquivo-b2":               # o copiador não tem contagem de pedidos
        pedidos, informados = ultima[1].get("pedidos"), ultima[1].get("informados")
        if not isinstance(pedidos, int) or not isinstance(informados, int):
            return PREFIXO + "-sem-contagem"
        if informados < pedidos:
            return PREFIXO + "-incompleto"
        # Sem arquivo pedido o verde só diz que os controles passaram: exige o estado explícito (nunca "ok" mudo).
        if pedidos == 0 and ultima[1].get("estado") != "aguardando_primeira_selagem":
            return PREFIXO + "-pedidos-0-sem-estado"
    return PREFIXO + "-ok"


try:
    print(olhar(sys.argv[1]))
except Exception as e:
    print("%s-leitura-%s" % (PREFIXO, type(e).__name__))
EOF
)
[ "$arq_@N@" = "@PREFIXO@-ok" ] && ok_arq_@N@=1 || ok_arq_@N@=0
[ "$ok_arq_@N@" -eq 1 ] && alvo_arq_@N@="$URL_ARQ_@V@" || alvo_arq_@N@="$URL_ARQ_@V@/fail"
for tentativa_arq_@N@ in 1 2 3 4 5; do
  curl -fsS -m 20 -o /dev/null "$alvo_arq_@N@" 2>/dev/null && break
  sleep $(( tentativa_arq_@N@ * 10 ))
done
[ "$ok_arq_@N@" -eq 1 ] || motivo="$motivo ${arq_@N@:-@PREFIXO@-mudo}"
@FECHA@
'''


def _jsonl(nome, v, logvar, log, prefixo, idade, porque):
    s = _MOLDE_JSONL
    for ficha, valor in (("@ABRE@", abre(nome)), ("@FECHA@", fecha(nome)), ("@N@", nome), ("@V@", v),
                         ("@LOGVAR@", logvar), ("@LOG@", log), ("@PREFIXO@", prefixo),
                         ("@IDADE@", str(idade)), ("@PORQUE@", porque)):
        s = s.replace(ficha, valor)
    return s


_PLANO = r'''@ABRE@
URL_ARQ_PULSO="@URL@"
# Pulso do arquivo (spec 02 §10.9): repassa a lista de vermelhos DO SITE, que o copiador grava em disco a cada plano.
# Verificação PRÓPRIA; mexe só em ok_arq_pulso e em $motivo. Âmbar nunca chega aqui: o site só põe vermelho na lista.
# Falha: plano ausente, ilegível, sem obtido_em, com 13 h ou mais (plano velho não vale), ou com `vermelhos`
# ausente ou nulo (é falha do pulso, nunca lista vazia). Verde: plano novo com `vermelhos: []`.
ARQ_PLANO="${ARQ_PLANO:-/opt/arquivo/estado/plano.json}"
arq_pulso=$(python3 - "$ARQ_PLANO" <<'EOF' 2>/dev/null
import json, os, sys, time
from datetime import datetime


def olhar(arq):
    if not os.path.exists(arq):
        return "arquivo-plano-ausente"
    with open(arq, encoding="utf-8") as f:
        d = json.load(f)
    if not isinstance(d, dict):
        return "arquivo-plano-formato"
    try:
        q = datetime.fromisoformat(str(d["obtido_em"]))
    except Exception:
        return "arquivo-plano-sem-hora"
    idade = int(time.time() - q.timestamp())
    if idade < -300:
        return "arquivo-plano-no-futuro"
    if idade >= 13 * 3600:
        return "arquivo-plano-velho-%ds" % idade
    v = d.get("vermelhos")
    if not isinstance(v, list):
        return "arquivo-plano-sem-vermelhos"
    if v:
        return "arquivo-vermelho:%d:%s" % (len(v), "_".join(str(v[0]).split())[:80])
    return "arquivo-pulso-ok"


try:
    print(olhar(sys.argv[1]))
except Exception as e:
    print("arquivo-plano-leitura-%s" % type(e).__name__)
EOF
)
[ "$arq_pulso" = "arquivo-pulso-ok" ] && ok_arq_pulso=1 || ok_arq_pulso=0
[ "$ok_arq_pulso" -eq 1 ] && alvo_arq_pulso="$URL_ARQ_PULSO" || alvo_arq_pulso="$URL_ARQ_PULSO/fail"
for tentativa_arq_pulso in 1 2 3 4 5; do
  curl -fsS -m 20 -o /dev/null "$alvo_arq_pulso" 2>/dev/null && break
  sleep $(( tentativa_arq_pulso * 10 ))
done
[ "$ok_arq_pulso" -eq 1 ] || motivo="$motivo ${arq_pulso:-arquivo-pulso-mudo}"
@FECHA@
'''.replace("@ABRE@", abre("pulso_arquivo")).replace("@FECHA@", fecha("pulso_arquivo"))

BLOCOS = {
    "copiador": _jsonl("copiador", "COPIADOR", "ARQ_COPIADOR_LOG", "/opt/arquivo/log/copiador.jsonl",
                       "arquivo-copiador", 48600,
                       "Limite 13 h 30: 12 h entre as duas execuções do dia + 40 min de timeout + 50 min de folga."),
    "conferir_b2": _jsonl("conferir_b2", "B2", "ARQ_B2_LOG", "/opt/arquivo/log/conferir-b2.jsonl",
                          "arquivo-b2", 91800,
                          "Limite 25 h 30: uma execução por dia + 40 min de timeout + 50 min de folga."),
    "pulso_arquivo": _PLANO,
}


def grava(s):
    fd = os.open("pulso.sh.tmp", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(s)


def pare(msg):
    print("PARE: " + msg)
    return 2


def main(argv):
    s = open("pulso.sh", encoding="utf-8").read()
    if argv[1:2] == ["--remover"]:
        out = s
        for n in NOMES:
            a, b = abre(n), fecha(n)
            if out.count(a) != 1 or out.count(b) != 1:
                return pare("%s ou o fechamento aparece fora de uma vez em pulso.sh; nada foi gravado" % a)
            i, j = out.index(a), out.index(b) + len(b)
            if j < i or out[j:j + 1] != "\n":
                return pare("marcadores de %s fora de ordem ou sem fim de linha; nada foi gravado" % n)
            out = out[:i] + out[j + 1:]
        grava(out)
        print("removido")
        return 0
    urls = argv[1:]
    if len(urls) != 3 or not all(RE_URL.match(u) for u in urls):
        return pare("passe as três URLs, na ordem copiador, conferência do B2, pulso; formato ^https://hc-ping\\.com/[0-9a-f-]{36}$")
    if len(set(urls)) != 3:
        return pare("as três verificações são diferentes: URL repetida")
    if set(RE_URL_NO_TEXTO.findall(s)) & set(urls):
        return pare("URL já usada no pulso.sh (a principal ou a da fila): cada verificação do arquivo é própria")
    if any(abre(n) in s or fecha(n) in s for n in NOMES):
        return pare("marcadores do arquivo já presentes em pulso.sh; nada foi gravado")
    if s.count(ANCORA) != 1:
        return pare("âncora %s aparece %d vez(es) em pulso.sh" % (ANCORA, s.count(ANCORA)))
    blocos = "".join(BLOCOS[n].replace("@URL@", u) for n, u in zip(NOMES, urls))
    grava(s.replace(ANCORA, blocos + ANCORA))
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 ~/Workspace/forja/ferramentas/arquivo/teste_pulso_arquivo.py`
Expected: `pulso arquivo: 0 falha(s)`. (Cada caso faz um `curl` falso; nenhum `sleep` real acontece, porque o `curl` falso sai 0.)

- [ ] **Step 5: Commit no kit**

```bash
K=~/Workspace/forja/ferramentas
git -C $K add -- arquivo/pulso_arquivo.py arquivo/teste_pulso_arquivo.py
git -C $K commit -m "feat: arquivo M3a, blocos do pulso (copiador, conferencia do B2, pulso do arquivo) com verificacao propria e instalador; instalacao na M3b" -- arquivo/pulso_arquivo.py arquivo/teste_pulso_arquivo.py
```

---

### Task 7: Trava no site: chaves `archive_*` nunca escrevem nem pegam tarefa, e a leitura delas fica registrada

**Files:**
- Modify: `apps/web/test/lib/pipeline/helpers-leitura.test.ts` (novo `describe` no fim; o arquivo já tem os mocks de `leitura-modo`, `leitura-registro` e `authenticatePipeline`)
- Modify: `apps/web/test/lib/pipeline/auth.test.ts:55-61` (dentro de `describe('requirePermission')`, depois de `'empty permissions deny everything'`; trava barata, fica também)

**Interfaces:**
- Consumes: `authenticateRead`, `authenticateWrite`, `authenticateIntel`, `authenticateReadOrIntel` (`apps/web/src/lib/pipeline/helpers.ts`); `modoLeitura()` (`apps/web/src/lib/pipeline/leitura-modo.ts:19`, hoje `modo: 'aviso'`); `requirePermission(auth, required)` (`apps/web/src/lib/pipeline/auth.ts:133`).
- Produces: nada novo. Quem decide nas 57 rotas de leitura é o `authenticateRead`, não o `requirePermission`: em modo aviso ele deixa passar **qualquer** chave válida sem `read` (o repositório prende isso em `helpers-leitura.test.ts`, "chave só com intelligence continua lendo"). Por isso este teste NÃO afirma que as chaves do arquivo "não abrem nada": afirma o que é verdade hoje (leem, e cada leitura é registrada; não escrevem; não pegam tarefa) e o que passa a valer em modo recusa (403). A M3b mantém este teste.

- [ ] **Step 1: Escrever o teste**

Acrescentar no fim de `apps/web/test/lib/pipeline/helpers-leitura.test.ts`:

```ts
describe('chaves archive_* da forja (M3a), antes das rotas da M3b', () => {
  const ARQ = ['archive_copy', 'archive_read', 'archive_b2']
  it('nunca escrevem nem pegam tarefa, em nenhum modo', async () => {
    for (const modo of ['aviso', 'recusa'] as const) {
      cfg.modo = modo
      for (const p of ARQ) {
        for (const porta of [authenticateWrite, authenticateIntel, authenticateReadOrIntel]) {
          entra(chave([p]))
          const r = await porta(req)
          expect(r instanceof Response && r.status).toBe(403)
        }
      }
    }
  })
  it('modo aviso (hoje): leem como qualquer chave sem read, e TODA leitura é registrada', async () => {
    for (const p of ARQ) {
      vi.clearAllMocks(); entra(chave([p]))
      expect(await authenticateRead(req)).toMatchObject({ ok: true })
      expect(registrarLeitura).toHaveBeenCalledWith(req, chave([p]), 'aviso')
    }
  })
  it('modo recusa: 403 e a recusa é registrada', async () => {
    cfg.modo = 'recusa'
    for (const p of ARQ) {
      vi.clearAllMocks(); entra(chave([p]))
      const r = await authenticateRead(req)
      expect(r instanceof Response && r.status).toBe(403)
      expect(registrarLeitura).toHaveBeenCalledWith(req, chave([p]), 'recusada')
    }
  })
})
```

E, em `apps/web/test/lib/pipeline/auth.test.ts`, dentro de `describe('requirePermission', ...)`, depois do `it('empty permissions deny everything', ...)`:

```ts
  it('archive_* keys (seeded in M3a, before the M3b routes) grant none of the existing scopes', () => {
    for (const p of ['archive_copy', 'archive_read', 'archive_b2']) {
      const auth = makeAuth([p])
      expect(requirePermission(auth, 'read')).toBe(false)
      expect(requirePermission(auth, 'write')).toBe(false)
      expect(requirePermission(auth, 'admin')).toBe(false)
      expect(requirePermission(auth, 'intelligence')).toBe(false)
    }
  })
```

- [ ] **Step 2: Rodar**

Run: `cd ~/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/lib/pipeline/helpers-leitura.test.ts test/lib/pipeline/auth.test.ts`
Expected: PASS. É teste de trava, e passa de primeira porque o código já está certo. Prova de que ele morde: trocar `'archive_copy'` por `'write'` no `ARQ` e ver o primeiro `it` falhar com `expected 200 ... 403` (ou `false` contra `403`); depois desfazer.

- [ ] **Step 3: Commit**

```bash
cd ~/Workspace/bythiagofigueiredo
git add apps/web/test/lib/pipeline/helpers-leitura.test.ts apps/web/test/lib/pipeline/auth.test.ts
git commit -m "test: chaves archive_* da forja (M3a) nunca escrevem nem pegam tarefa, e a leitura delas fica registrada, antes das rotas da M3b

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/test/lib/pipeline/helpers-leitura.test.ts apps/web/test/lib/pipeline/auth.test.ts
```

---

### Task 8: Os arquivos de comandos do dono, o LEIAME, o runbook de volta e o ledger

**Files:**
- Create: `.superpowers/sdd/manutencao-nas/m3a/m3a-0-leituras-antes.sh`
- Create: `.superpowers/sdd/manutencao-nas/m3a/m3a-4-nas-sentinelas.sh`
- Create: `.superpowers/sdd/manutencao-nas/m3a/m3a-5-forja-instalar.sh`
- Create: `.superpowers/sdd/manutencao-nas/m3a/m3a-6-prova-escrita.sh`
- Create: `.superpowers/sdd/manutencao-nas/m3a/m3a-8-chaves.sh`
- Create: `.superpowers/sdd/manutencao-nas/m3a/m3a-10-prova-b2.sh`
- Create: `.superpowers/sdd/manutencao-nas/m3a/m3a-11-conferencia-final.sh`
- Create: `.superpowers/sdd/manutencao-nas/RUNBOOK-rollback-e-referencia.md`
- Create: `.superpowers/sdd/manutencao-nas/m3a-progresso.md`
- Modify: `.superpowers/sdd/manutencao-nas/LEIAME-COMANDOS.md` (a seção "AGORA" atual vai para o histórico; entra a da M3a)

**Interfaces:**
- Consumes: os arquivos do kit das Tarefas 1 a 6, já commitados.
- Produces: os comandos que a Tarefa 9 manda o dono rodar, cada um com saída em `saidas/m3a-<n>-<AAAA-MM-DD-HHMM>.txt`.

Os scripts de leitura usam os ajudantes do `leituras-nas.sh` (`n` para o NAS, `f` para a forja, `m` para o Mac). Os que escrevem usam `x`, que mostra o comando, grava a saída e para no primeiro erro.

- [ ] **Step 1: `m3a-0-leituras-antes.sh` (só leitura)**

```bash
#!/bin/bash
# M3a, bloco 0: leituras antes de mexer. Só leitura no NAS, na forja e no banco.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-0-leituras-antes.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-0-antes-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
n() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 nas "$2" >> "$O" 2>&1; echo >> "$O"; }
f() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 forja "$2" >> "$O" 2>&1; echo >> "$O"; }
m() { echo "### $1" >> "$O"; bash -c "$2" >> "$O" 2>&1; echo >> "$O"; }
n nas-usuario "id"
n nas-fuso "midclt call system.general.config | python3 -m json.tool | grep -E '\"timezone\"'"
n nas-appdata-filhos "zfs list -o name,used,avail,quota,refquota,encryption -r -d 1 fast/appdata"
n nas-site-arquivo-nao-existe "zfs list fast/appdata/site-arquivo 2>&1 | tail -1"
n nas-tarefas-b2 "midclt call cloudsync.query | python3 -m json.tool | grep -E '\"description\"|\"path\"|\"transfer_mode\"|\"exclude\"|\"bucket\"|\"folder\"|\"hour\"|\"minute\"|\"enabled\"'"
n nas-credenciais-b2 "midclt call cloudsync.credentials.query | python3 -m json.tool | grep -E '\"id\"|\"name\"|\"type\"'"
n nas-nfs "midclt call sharing.nfs.query | python3 -m json.tool | grep -E '\"path\"|\"ro\"|\"hosts\"|\"networks\"|\"mapall_user\"|\"maproot_user\"|\"enabled\"'"
f forja-crontab "crontab -l | sed -E 's#hc-ping.com/[0-9a-f-]+#hc-ping.com/X#g'"
f forja-crontab-md5 "crontab -l | md5sum"
f forja-pulso-md5 "md5sum /opt/agente/docs/pulso.sh"
f forja-sudo-CP17 "sudo -n true 2>&1 && echo SEM-SENHA || echo PEDE-SENHA"
f forja-cifra-CP30 "lsblk -o NAME,TYPE,FSTYPE,MOUNTPOINT | grep -i crypt || echo SEM-CIFRA"
f forja-nfs "findmnt -t nfs4 -o TARGET,SOURCE,OPTIONS"
f forja-rclone-CP25 "command -v rclone || echo sem-rclone; apt-cache policy rclone | head -3"
f forja-arquivo-nao-existe "ls -ld /opt/arquivo /mnt/arquivo ~/.config/rclone 2>&1"
f forja-relogio "date -Is; timedatectl | grep -E 'Time zone|synchronized'"
m kit "cd ~/Workspace/forja/ferramentas && git status --short -- arquivo seed_chave_forja.sh && git log --oneline -8"
m chaves-CP5 "cd ~/Workspace/bythiagofigueiredo && npx supabase db query --linked \"select name, permissions, revoked_at is null as ativa from pipeline_api_keys order by 1;\""
echo "pronto: $(grep -c '^###' "$O") leituras em $O"
```

- [ ] **Step 2: `m3a-4-nas-sentinelas.sh` (escreve as duas sentinelas no NAS)**

```bash
#!/bin/bash
# M3a, bloco 4: as duas sentinelas no NAS (escrita, é do dono) e as leituras do que o bloco 3 criou pela tela.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-4-nas-sentinelas.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-4-sentinelas-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
n() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 nas "$2" >> "$O" 2>&1; echo >> "$O"; }
x ssh nas 'test -d /mnt/fast/appdata/site-arquivo/numerico && test -d /mnt/fast/appdata/site-arquivo/texto'
x ssh nas 'touch /mnt/fast/appdata/site-arquivo/numerico/.arquivo-vivo'
x ssh nas 'touch /mnt/fast/appdata/site-arquivo/texto/.arquivo-vivo'
n datasets "zfs list -o name,used,avail,quota,refquota,encryption,encryptionroot,keystatus,mountpoint -r fast/appdata/site-arquivo"
n donos "ls -lan /mnt/fast/appdata/site-arquivo /mnt/fast/appdata/site-arquivo/numerico /mnt/fast/appdata/site-arquivo/texto"
n tarefas-b2 "midclt call cloudsync.query | python3 -m json.tool | grep -E '\"description\"|\"path\"|\"transfer_mode\"|\"encryption\"|\"filename_encryption\"|\"exclude\"|\"bucket\"|\"folder\"|\"hour\"|\"minute\"|\"enabled\"'"
n nfs "midclt call sharing.nfs.query | python3 -m json.tool | grep -E '\"path\"|\"ro\"|\"hosts\"|\"mapall_user\"|\"enabled\"'"
echo "pronto: $O"
```

- [ ] **Step 3: `m3a-5-forja-instalar.sh` (escreve na forja; uma senha de `sudo`)**

```bash
#!/bin/bash
# M3a, bloco 5: copia o kit para ~/.arquivo-m3a (700) na forja e roda o instalador de root (uma senha de sudo).
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-5-forja-instalar.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
K=~/Workspace/forja/ferramentas
O=$S/saidas/m3a-5-forja-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
f() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 forja "$2" >> "$O" 2>&1; echo >> "$O"; }
[ -z "$(git -C $K status --porcelain -- arquivo seed_chave_forja.sh)" ] || { echo "PARE: o kit tem mudança sem commit em arquivo/ ou no seed" | tee -a "$O"; exit 1; }
git -C $K log --oneline -1 >> "$O"
x ssh forja 'mkdir -p -m 700 ~/.arquivo-m3a'
x scp $K/arquivo/mnt-arquivo-escrita-numerico.mount $K/arquivo/mnt-arquivo-escrita-texto.mount forja:.arquivo-m3a/
x scp $K/arquivo/mnt-arquivo-leitura-numerico.mount $K/arquivo/mnt-arquivo-leitura-texto.mount forja:.arquivo-m3a/
x scp $K/arquivo/instalar-casa-forja.sh $K/arquivo/nova_chave_arquivo.py $K/arquivo/configurar_rclone.py forja:.arquivo-m3a/
x ssh -t forja 'sudo bash /home/thiago/.arquivo-m3a/instalar-casa-forja.sh'
f montagens-CP10 "findmnt -t nfs4 -o TARGET,SOURCE,OPTIONS | grep arquivo"
f ponto-de-montagem "for d in escrita/numerico escrita/texto leitura/numerico leitura/texto; do mountpoint /mnt/arquivo/\$d; done"
f sentinelas "ls -la /mnt/arquivo/escrita/numerico/.arquivo-vivo /mnt/arquivo/escrita/texto/.arquivo-vivo /mnt/arquivo/leitura/numerico/.arquivo-vivo /mnt/arquivo/leitura/texto/.arquivo-vivo"
f opt-arquivo "stat -c '%a %U %n' /opt/arquivo /opt/arquivo/log /opt/arquivo/ferramentas /opt/arquivo/estado /opt/arquivo/chaves /opt/arquivo/ferramentas/*.py"
f rclone "rclone version | head -1"
f obscure-pela-entrada "o=\$(printf 'abcdef\n' | rclone obscure -); rclone reveal \"\$o\""
echo "pronto: $O"
```

(O último é uma leitura de capacidade com valor de teste, sem segredo: o `rclone obscure -` tem de ler da entrada padrão, e `rclone reveal` tem de devolver `abcdef`. Qualquer outra saída é não, e o `configurar_rclone.py` também confere o tamanho do valor obscurecido e para sozinho no bloco 9.)

- [ ] **Step 4: `m3a-6-prova-escrita.sh` (CP16, CP10 e os arquivos de prova)**

```bash
#!/bin/bash
# M3a, bloco 6: prova de escrita em cada filho (CP16), prova de que a leitura recusa escrita (CP10, item 18)
# e o arquivo de prova de cada filho para o bloco 10 (ida e volta pelo B2), mais um arquivo em _recebendo/ que a exclusão
# da tarefa nova tem de deixar de fora (sem dado, a exclusão passaria verde sem ser exercitada). Escreve na forja: é do dono.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-6-prova-escrita.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-6-prova-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
for filho in numerico texto; do
  x ssh forja "mountpoint -q /mnt/arquivo/escrita/$filho"
  x ssh forja "touch /mnt/arquivo/escrita/$filho/.teste-escrita"
  ssh nas "ls -la /mnt/fast/appdata/site-arquivo/$filho/.teste-escrita" >> "$O" 2>&1 \
    || { echo "PARE-CP16-$filho: o arquivo não está no NAS dentro do filho. Plano B (RUNBOOK, M3a)." | tee -a "$O"; exit 1; }
  fonte=$(ssh nas "df --output=source /mnt/fast/appdata/site-arquivo/$filho/.teste-escrita | tail -1" 2>>"$O")
  [ "$fonte" = "fast/appdata/site-arquivo/$filho" ] && echo "CP16-$filho: OK ($fonte)" | tee -a "$O" \
    || { echo "PARE-CP16-$filho: o arquivo está em '$fonte', não no filho. Plano B (RUNBOOK, M3a)." | tee -a "$O"; exit 1; }
  x ssh forja "rm /mnt/arquivo/escrita/$filho/.teste-escrita"
  x ssh forja "mountpoint -q /mnt/arquivo/leitura/$filho"
  if ssh forja "touch /mnt/arquivo/leitura/$filho/.nao-pode" >> "$O" 2>&1; then
    echo "CP10-$filho: FALHOU, a montagem de leitura aceitou escrita (plano B: RUNBOOK, M3a)" | tee -a "$O"
    ssh forja "rm -f /mnt/arquivo/escrita/$filho/.nao-pode" >> "$O" 2>&1
  elif grep -q "Read-only file system" <(ssh forja "touch /mnt/arquivo/leitura/$filho/.nao-pode" 2>&1); then
    echo "CP10-$filho: OK, a leitura recusou a escrita (Read-only file system)" | tee -a "$O"
  else
    echo "PARE-CP10-$filho: o touch falhou por outro motivo; ver a saída" | tee -a "$O"; exit 1
  fi
  x ssh forja "mkdir -p /mnt/arquivo/escrita/$filho/_canario"
  x ssh forja "head -c 4096 /dev/urandom > /mnt/arquivo/escrita/$filho/_canario/prova-m3a"
  x ssh forja "mkdir -p /mnt/arquivo/escrita/$filho/_recebendo && head -c 512 /dev/urandom > /mnt/arquivo/escrita/$filho/_recebendo/prova-exclusao"
  x ssh forja "sha256sum /mnt/arquivo/leitura/$filho/_canario/prova-m3a"
done
ssh nas "zfs list -o name,used,quota,refquota,mountpoint -r fast/appdata/site-arquivo" >> "$O" 2>&1
echo "pronto: $O"
```

- [ ] **Step 5: `m3a-8-chaves.sh` (gera as três chaves na forja e registra os hashes)**

```bash
#!/bin/bash
# M3a, bloco 8: as três chaves de API do arquivo. A chave nasce na forja e fica lá (0600); só o sha256 vem ao Mac
# e vai ao banco pelo seed do kit, que NUNCA revoga nada nestes modos. Repetir é seguro: a chave existente é reaproveitada.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-8-chaves.sh
set -o pipefail
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-8-chaves-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
for p in copiador respondedor conferidor; do
  h=$(ssh forja "python3 /opt/arquivo/ferramentas/nova_chave_arquivo.py $p" 2>>"$O") || { echo "PARE: nova_chave $p" | tee -a "$O"; exit 1; }
  [[ "$h" =~ ^[0-9a-f]{64}$ ]] || { echo "PARE: saída inesperada da forja para $p" | tee -a "$O"; exit 1; }
  echo "### seed $p" | tee -a "$O"
  bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh "$p" "$h" 2>&1 | tee -a "$O" || { echo "PARE: seed $p" | tee -a "$O"; exit 1; }
done
ssh forja "stat -c '%a %U %n' /opt/arquivo/chaves /opt/arquivo/chaves/*.chave" >> "$O" 2>&1
cd ~/Workspace/bythiagofigueiredo && npx supabase db query --linked "select name, permissions, revoked_at is null as ativa, revoked_at::date as revogada_em from pipeline_api_keys order by 1;" >> "$O" 2>&1
echo "pronto: $O"
```

- [ ] **Step 6: `m3a-10-prova-b2.sh` (só leitura: a chave do cofre decifra o que o TrueNAS subiu)**

```bash
#!/bin/bash
# M3a, bloco 10: prova de ida e volta pelo B2, só leitura. Com a cifra de nome desligada, uma LISTA legível não prova
# a chave (os nomes são legíveis com qualquer senha) e um bucket vazio lista vazio sem erro: só o CONTEÚDO prova.
# O lado "NAS" da comparação é lido no NAS (o que o TrueNAS subiu), não na montagem de leitura da forja.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-10-prova-b2.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-10-prova-b2-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
f() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 forja "$2" >> "$O" 2>&1; echo >> "$O"; }
f rclone "rclone version | head -1"
f conf-permissoes "stat -c '%a %U %n' ~/.config/rclone ~/.config/rclone/rclone.conf"
f remotos "rclone listremotes"
R=$(ssh forja "grep -m1 '^remote = ' ~/.config/rclone/rclone.conf | cut -d' ' -f3")
[ -n "$R" ] || { echo "PARE: rclone.conf sem remoto crypt (bloco 9)" | tee -a "$O"; exit 1; }
echo "remoto cru: $R" >> "$O"
for filho in numerico texto; do
  local_=$(ssh nas "sha256sum /mnt/fast/appdata/site-arquivo/$filho/_canario/prova-m3a" | cut -d' ' -f1)
  b2=$(ssh forja "rclone cat arq:$filho/_canario/prova-m3a 2>~/.arquivo-m3a/m3a-cat.err | sha256sum" | cut -d' ' -f1)
  erro=$(ssh forja "head -c 400 ~/.arquivo-m3a/m3a-cat.err; rm -f ~/.arquivo-m3a/m3a-cat.err")
  echo "erro-do-rclone-$filho: ${erro:-nenhum}" >> "$O"
  if [ -n "$local_" ] && [ "$local_" = "$b2" ] && [ "$b2" != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" ]; then
    echo "PROVA-$filho: OK" | tee -a "$O"
  elif printf '%s' "$erro" | grep -qiE 'authenticate|decrypt|bad password|not an encrypted|magic'; then
    echo "PROVA-$filho: FALHOU-CIFRA (o B2 respondeu; a senha ou o sal da forja não são os do TrueNAS)" | tee -a "$O"
  elif printf '%s' "$erro" | grep -qiE 'not found|no such|directory not found'; then
    echo "PROVA-$filho: FALHOU-CAMINHO (bucket, pasta, ou a tarefa não subiu)" | tee -a "$O"
  elif printf '%s' "$erro" | grep -qiE '401|403|unauthori|forbidden|bad_auth'; then
    echo "PROVA-$filho: FALHOU-CHAVE-B2" | tee -a "$O"
  else
    echo "PROVA-$filho: FALHOU (nas=$local_ b2=$b2; ver erro-do-rclone-$filho)" | tee -a "$O"
  fi
  neg=$(ssh forja "rclone cat arq:$filho/_canario/nao-existe-m3a 2>&1 >/dev/null; echo rc=\$?")
  echo "neg-$filho: $neg" >> "$O"
  if printf '%s' "$neg" | grep -q 'rc=0'; then
    echo "CONTROLE-NEGATIVO-$filho: FALHOU (disse presente)" | tee -a "$O"
  elif printf '%s' "$neg" | grep -qiE 'not found|no such'; then
    echo "CONTROLE-NEGATIVO-$filho: OK" | tee -a "$O"
  else
    echo "CONTROLE-NEGATIVO-$filho: INCONCLUSIVO ($neg)" | tee -a "$O"
  fi
  f "b2-cru-lsjson-$filho" "rclone lsjson '$R/$filho/_canario/'"
  f "b2-cru-metadata-$filho" "rclone lsjson -M '$R/$filho/_canario/' 2>&1 | head -40"
  f "b2-versoes-CP32-$filho" "rclone lsf '$R/$filho/_canario' --b2-versions | head -5"
  if [ "$filho" = numerico ]; then
    f "versoes-ids-numerico" "rclone lsjson --b2-versions '$R/numerico/_canario/'"
    f "versao-antiga-decifra" "rclone lsf --b2-versions arq:numerico/_canario/ ; for n in \$(rclone lsf --b2-versions arq:numerico/_canario/ | grep 'prova-m3a-v'); do rclone cat --b2-versions arq:numerico/_canario/\$n | sha256sum; done"
  fi
done
echo "pronto: $O"
```

- [ ] **Step 7: `m3a-11-conferencia-final.sh` (só leitura; fecha os itens 16, 18 e 33)**

```bash
#!/bin/bash
# M3a, bloco 11: conferência final, só leitura. Compara com o bloco 0: a fila não mudou (item 33).
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-11-conferencia-final.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
K=~/Workspace/forja/ferramentas
O=$S/saidas/m3a-11-final-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
n() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 nas "$2" >> "$O" 2>&1; echo >> "$O"; }
f() { echo "### $1" >> "$O"; ssh -o ConnectTimeout=15 forja "$2" >> "$O" 2>&1; echo >> "$O"; }
m() { echo "### $1" >> "$O"; bash -c "$2" >> "$O" 2>&1; echo >> "$O"; }
n item16-datasets "zfs list -o name,used,avail,quota,refquota,encryption,encryptionroot,keystatus,mountpoint -r fast/appdata/site-arquivo"
n item16-tarefas-b2 "midclt call cloudsync.query | python3 -m json.tool | grep -E '\"description\"|\"path\"|\"transfer_mode\"|\"encryption\"|\"filename_encryption\"|\"exclude\"|\"bucket\"|\"folder\"|\"hour\"|\"minute\"|\"enabled\"'"
n item16-nfs "midclt call sharing.nfs.query | python3 -m json.tool | grep -E '\"path\"|\"ro\"|\"hosts\"|\"mapall_user\"|\"enabled\"'"
n item16-arquivos "find /mnt/fast/appdata/site-arquivo -type f | sort"
f item18-montagens "findmnt -t nfs4 -o TARGET,SOURCE,OPTIONS | grep arquivo"
f item18-sentinelas "ls -la /mnt/arquivo/escrita/numerico/.arquivo-vivo /mnt/arquivo/escrita/texto/.arquivo-vivo /mnt/arquivo/leitura/numerico/.arquivo-vivo /mnt/arquivo/leitura/texto/.arquivo-vivo"
f item33-crontab-md5 "crontab -l | md5sum"
f item33-pulso-md5 "md5sum /opt/agente/docs/pulso.sh"
f chaves-e-conf "stat -c '%a %U %n' /opt/arquivo/chaves /opt/arquivo/chaves/*.chave ~/.config/rclone ~/.config/rclone/rclone.conf"
m ferramentas-iguais-ao-kit "cd $K/arquivo && md5 -r nova_chave_arquivo.py configurar_rclone.py | sed 's/ /  /' | ssh forja 'cd /opt/arquivo/ferramentas && md5sum -c --quiet' && echo FERRAMENTAS-IGUAIS"
m unidades-iguais-ao-kit "cd $K/arquivo && md5 -r mnt-arquivo-*.mount | sed 's/ /  /' | ssh forja 'cd /etc/systemd/system && md5sum -c --quiet' && echo UNIDADES-IGUAIS"
m chaves-CP5 "cd ~/Workspace/bythiagofigueiredo && npx supabase db query --linked \"select name, permissions, revoked_at is null as ativa, revoked_at::date as revogada_em from pipeline_api_keys order by 1;\""
m uso-das-chaves-arquivo "cd ~/Workspace/bythiagofigueiredo && npx supabase db query --linked \"select count(*) as leituras from audit_log where after_data->>'key_name' like 'forja (arquivo %';\""
A=$(ls -t $S/saidas/m3a-0-antes-*.txt | head -1)
for t in forja-crontab-md5 forja-pulso-md5; do
  antes=$(awk -v t="### $t" '$0==t{getline; print; exit}' "$A")
  novo=$(awk -v t="### item33-${t#forja-}" '$0==t{getline; print; exit}' "$O")
  [ -n "$antes" ] && [[ "$antes" =~ ^[0-9a-f]{32}\  ]] && [ "${antes%% *}" != d41d8cd98f00b204e9800998ecf8427e ] && [ "$antes" = "$novo" ] && echo "ITEM33-$t: IGUAL" | tee -a "$O" || echo "ITEM33-$t: MUDOU (antes=$antes agora=$novo)" | tee -a "$O"
done
echo "pronto: $O"
```

- [ ] **Step 7a: Escritas do dono dos blocos 7 e 11 e os arquivos de volta atrás / plano B**

Tudo que escreve na forja ou no NAS é arquivo de comandos com uma linha que o roda (nada para colar).

`m3a-7-segunda-versao.sh` (bloco 7, passo 4: segunda versão do canário de `numerico`, para provar a restauração por versão, Su1):

```bash
#!/bin/bash
# M3a, bloco 7, passo 4: grava uma SEGUNDA versão de numerico/_canario/prova-m3a e anota o sha256 novo e a hora.
# Só depois disto roda-se o Run Now de novo (cliques). Escreve na forja: é do dono.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-7-segunda-versao.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-7-segunda-versao-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
x ssh forja "mountpoint -q /mnt/arquivo/escrita/numerico"
x ssh forja 'head -c 4096 /dev/urandom > /mnt/arquivo/escrita/numerico/_canario/prova-m3a'
x ssh nas 'sha256sum /mnt/fast/appdata/site-arquivo/numerico/_canario/prova-m3a'
x date -Is
echo "pronto: $O (agora o Run Now da tarefa, de novo; anotar T1 do bloco 6 e T2 do Run Now no ledger)"
```

`m3a-11a-limpar-prova-exclusao.sh` (antes da conferência final: apaga as duas provas de `_recebendo`, para a M3b não achar resto que pareça escrita interrompida):

```bash
#!/bin/bash
# M3a, bloco 11, antes da conferência: apaga as duas provas de exclusão de _recebendo/. Escreve na forja: é do dono.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-11a-limpar-prova-exclusao.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-11a-limpar-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
for filho in numerico texto; do
  x ssh forja "mountpoint -q /mnt/arquivo/escrita/$filho"
  x ssh forja "rm /mnt/arquivo/escrita/$filho/_recebendo/prova-exclusao"
done
echo "pronto: $O"
```

`m3a-10a-permissoes.sh` (só se o bloco 10 mostrar permissões diferentes de `700` e `600`):

```bash
#!/bin/bash
# M3a, bloco 10a: fecha a pasta e o arquivo do rclone na forja (a chave da cifra não pode ser legível por outros). Escreve na forja.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-10a-permissoes.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-10a-permissoes-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
x ssh forja 'chmod 700 ~/.config/rclone'
x ssh forja 'chmod 600 ~/.config/rclone/rclone.conf'
x ssh forja "stat -c '%a %U %n' ~/.config/rclone ~/.config/rclone/rclone.conf"
echo "pronto: $O (repetir o bloco 10)"
```

Planos B e volta atrás. Cada um é um arquivo em `m3a/`, com saída em `saidas/`, rodado pelo dono (uma linha) só quando o caso acontecer; o controlador lê o arquivo contra o caso antes de liberar.

`m3a-pb-cp16.sh` (plano B do CP16, depois dos cliques 1 a 3 e do passo 4 do RUNBOOK):

```bash
#!/bin/bash
# M3a, plano B do CP16 (dataset único): desliga e remove as quatro unidades na forja (uma senha de sudo) e recria
# numerico/ e texto/ como PASTAS no NAS, com a sentinela única. Depois: repetir o bloco 5.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-pb-cp16.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-pb-cp16-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
x ssh -t forja 'sudo sh -c "systemctl disable --now mnt-arquivo-escrita-numerico.mount mnt-arquivo-escrita-texto.mount mnt-arquivo-leitura-numerico.mount mnt-arquivo-leitura-texto.mount; rm -f /etc/systemd/system/mnt-arquivo-escrita-numerico.mount /etc/systemd/system/mnt-arquivo-escrita-texto.mount /etc/systemd/system/mnt-arquivo-leitura-numerico.mount /etc/systemd/system/mnt-arquivo-leitura-texto.mount; systemctl daemon-reload"'
x ssh nas 'mkdir -p /mnt/fast/appdata/site-arquivo/numerico /mnt/fast/appdata/site-arquivo/texto && touch /mnt/fast/appdata/site-arquivo/.arquivo-vivo'
echo "pronto: $O (agora o bloco 5 de novo, com as unidades novas do kit)"
```

`m3a-pb-cp10.sh` (plano B do CP10, nas duas formas: a leitura aceitou escrita, ou a leitura não monta):

```bash
#!/bin/bash
# M3a, plano B do CP10: desliga as duas montagens de leitura na forja (uma senha de sudo). O respondedor (M3b) usa a
# montagem de escrita com ReadOnlyPaths=/mnt/arquivo/escrita na unidade do serviço; o item 18 fecha por ele.
# Uso: bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-pb-cp10.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-pb-cp10-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
x ssh -t forja 'sudo systemctl disable --now mnt-arquivo-leitura-numerico.mount mnt-arquivo-leitura-texto.mount'
echo "pronto: $O (registrar no ledger; os blocos 6 e 10 deixam de usar /mnt/arquivo/leitura)"
```

`m3a-pb-rclone.sh` (plano B do rclone, só se o bloco 10 der `FALHOU-CIFRA` com o cofre conferido). O pacote só é instalado se o `SHA256SUMS` tiver assinatura válida: o controlador baixa a chave pública da página oficial do rclone, confere a impressão digital com o dono e a põe em `m3a/rclone-chave-publica.asc` antes (NÃO VERIFICADO: o endereço e a impressão digital; sem o arquivo o script para):

```bash
#!/bin/bash
# M3a, plano B do rclone: binário oficial com a assinatura do SHA256SUMS verificada (gpg) antes do sha256sum -c.
# VERSAO: a que o `rclone version` do shell do TrueNAS mostrar, ou a mais nova (NÃO VERIFICADO).
# Uso: VERSAO=v1.68.2 bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-pb-rclone.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-pb-rclone-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
V=${VERSAO:?defina VERSAO, por exemplo VERSAO=v1.68.2}
CH=$S/m3a/rclone-chave-publica.asc
[ -s "$CH" ] || { echo "PARE: falta $CH (chave pública do rclone, impressão digital conferida com o dono)" | tee -a "$O"; exit 1; }
x ssh forja 'mkdir -p -m 700 ~/.arquivo-pb'
x scp "$CH" forja:.arquivo-pb/rclone-chave-publica.asc
x ssh forja "cd ~/.arquivo-pb && curl -fsSLO https://downloads.rclone.org/$V/rclone-$V-linux-amd64.zip && curl -fsSLO https://downloads.rclone.org/$V/SHA256SUMS"
x ssh forja 'cd ~/.arquivo-pb && gpg --dearmor < rclone-chave-publica.asc > rclone.gpg && gpgv --keyring ./rclone.gpg SHA256SUMS'
x ssh forja "cd ~/.arquivo-pb && sha256sum -c --ignore-missing SHA256SUMS"
x ssh forja "cd ~/.arquivo-pb && python3 -m zipfile -e rclone-$V-linux-amd64.zip ."
x ssh -t forja "sudo install -m 755 /home/thiago/.arquivo-pb/rclone-$V-linux-amd64/rclone /usr/local/bin/rclone"
x ssh forja 'command -v rclone; rclone version | head -1'
echo "pronto: $O (/usr/local/bin vem antes de /usr/bin no PATH do Ubuntu; repetir o bloco 10)"
```

`m3a-desfazer-forja.sh` (desistir da M3a; nada aqui apaga dado, porque não há dado):

```bash
#!/bin/bash
# M3a, desfazer na forja: desliga e remove as quatro montagens, /opt/arquivo e a configuração do rclone (uma senha de sudo).
# Exige CONFIRMAR=sim. Uso: CONFIRMAR=sim bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-desfazer-forja.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-desfazer-forja-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
[ "${CONFIRMAR:-}" = sim ] || { echo "PARE: defina CONFIRMAR=sim" | tee -a "$O"; exit 1; }
x ssh -t forja 'sudo sh -c "systemctl disable --now mnt-arquivo-escrita-numerico.mount mnt-arquivo-escrita-texto.mount mnt-arquivo-leitura-numerico.mount mnt-arquivo-leitura-texto.mount; rm -r /opt/arquivo; rm -f /etc/systemd/system/mnt-arquivo-escrita-numerico.mount /etc/systemd/system/mnt-arquivo-escrita-texto.mount /etc/systemd/system/mnt-arquivo-leitura-numerico.mount /etc/systemd/system/mnt-arquivo-leitura-texto.mount; systemctl daemon-reload"'
x ssh forja 'rm -r ~/.config/rclone'
echo "pronto: $O"
```

`m3a-desfazer-banco.sh` (revoga SÓ as três chaves do arquivo; nunca a `forja (fila)` nem a de leitura):

```bash
#!/bin/bash
# M3a, desfazer no banco: revoga as três chaves forja (arquivo ...) e mostra exatamente quais. Exige CONFIRMAR=sim.
# Uso: CONFIRMAR=sim bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-desfazer-banco.sh
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
O=$S/saidas/m3a-desfazer-banco-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
[ "${CONFIRMAR:-}" = sim ] || { echo "PARE: defina CONFIRMAR=sim" | tee -a "$O"; exit 1; }
cd ~/Workspace/bythiagofigueiredo && npx supabase db query --linked "update pipeline_api_keys set revoked_at = now() where name in ('forja (arquivo copiador)', 'forja (arquivo respondedor)', 'forja (arquivo conferidor)') and revoked_at is null returning name;" 2>&1 | tee -a "$O"
echo "pronto: $O (conferir que só as chaves 'forja (arquivo ...)' apareceram)"
```

`m3a-rotacao-chave.sh` (rotação de UMA chave; não é da M3a. Revoga só a do programa dado, guarda a chave velha na forja e manda rodar o bloco 8; a segunda forma apaga a `.velha` depois):

```bash
#!/bin/bash
# Rotação da chave de API de UM programa do arquivo (copiador | respondedor | conferidor).
#   1) bash m3a-rotacao-chave.sh <programa>                  revoga SÓ a dele e guarda a chave velha na forja
#   2) bash m3a-8-chaves.sh                                  gera a nova (as outras duas são reaproveitadas)
#   3) bash m3a-rotacao-chave.sh <programa> apagar-velha     apaga a .velha
S=~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas
P=${1:-}; [[ "$P" =~ ^(copiador|respondedor|conferidor)$ ]] || { echo "PARE: uso: m3a-rotacao-chave.sh copiador|respondedor|conferidor [apagar-velha]"; exit 1; }
O=$S/saidas/m3a-rotacao-$P-$(date +%Y-%m-%d-%H%M).txt; mkdir -p "$S/saidas"; : > "$O"
x() { echo "\$ $*" | tee -a "$O"; "$@" 2>&1 | tee -a "$O"; r=${PIPESTATUS[0]}; [ "$r" = 0 ] || { echo "PARE: falhou (rc=$r): $*" | tee -a "$O"; exit 1; }; }
if [ "${2:-}" = apagar-velha ]; then
  x ssh forja "rm /opt/arquivo/chaves/$P.chave.velha"
else
  x bash -c "cd ~/Workspace/bythiagofigueiredo && npx supabase db query --linked \"update pipeline_api_keys set revoked_at = now() where name = 'forja (arquivo $P)' and revoked_at is null returning name;\""
  x ssh forja "mv /opt/arquivo/chaves/$P.chave /opt/arquivo/chaves/$P.chave.velha"
  echo "A consulta acima tem de mostrar EXATAMENTE uma linha, a de 'forja (arquivo $P)'. Agora: bash m3a-8-chaves.sh" | tee -a "$O"
fi
echo "pronto: $O"
```

- [ ] **Step 8: Conferir a sintaxe de todos**

Run: `for s in ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/*.sh; do bash -n "$s" && echo "OK $s"; done; command -v shellcheck >/dev/null && shellcheck -S warning ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/*.sh`
Expected: `OK` para todos os `m3a-*.sh`; se o `shellcheck` existir, nenhum aviso de nível `warning` além de SC2029 (expansão do lado do cliente no `ssh`, que é intencional aqui).

- [ ] **Step 9: `RUNBOOK-rollback-e-referencia.md` (seção M3a)**

Conteúdo (arquivo novo; outras etapas acrescentam seções). **O RUNBOOK não traz comando de escrita para colar** (regra do dono, `05` §16): cada volta atrás ou plano B é um arquivo de comandos de `m3a/` (Step 7a) com uma linha curta que o roda; aqui fica o porquê e a ordem.

````markdown
# Manutenção do arquivo: volta atrás e referência

Aqui fica o que não é caminho para a frente: como desfazer, planos B e explicações. O caminho para a frente é o LEIAME-COMANDOS.md.

**Regra deste arquivo:** nada aqui é para colar. Cada plano B e cada volta atrás é um arquivo de comandos em `m3a/` (formato do bloco 5, saída em `saidas/`), com uma linha que o roda. O controlador lê o arquivo contra o caso antes de o dono rodar; os textos abaixo descrevem o que o arquivo faz.

## M3a (casa)

### Plano B do CP16: o arquivo gravado pela forja não caiu dentro do filho

Spec 02 §9.4. `numerico` e `texto` viram diretórios comuns de um dataset só.

1. (clique) Shares, NFS: apagar as duas exportações dos filhos.
2. (clique) Datasets: apagar `numerico` e `texto` (estão vazios, salvo a sentinela e as provas). Em `site-arquivo`, pôr `refquota` de 20 GiB (o `quota` já está).
3. (clique) Shares, NFS, Add: `/mnt/fast/appdata/site-arquivo`, hosts `100.89.6.27`, `mapall truenas_admin`.
4. (controlador, no kit) Trocar as quatro unidades por duas (`mnt-arquivo-escrita.mount`, `What=100.109.2.17:/mnt/fast/appdata/site-arquivo`, `Where=/mnt/arquivo/escrita`, `rw`; e `mnt-arquivo-leitura.mount`, igual com `Where=/mnt/arquivo/leitura` e `ro`), ajustar o `teste_montagens.py` e o `instalar-casa-forja.sh`, e commitar. Os caminhos `/mnt/arquivo/escrita/numerico` etc. continuam valendo, agora como subpastas.
5. (dono) `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-pb-cp16.sh`: desliga e remove as quatro unidades na forja, recria `numerico` e `texto` como pastas no NAS e põe **uma** sentinela, `site-arquivo/.arquivo-vivo`. Depois, repetir o bloco 5.
6. Os itens 16, 18 e 27 valem com o dataset único (spec 02 §9.4); a M3b é avisada.

### Plano B do CP10: a montagem de leitura aceitou escrita, ou a leitura não monta

Duas formas, o mesmo remédio. (1) O `ro` não pegou (`CP10-<filho>: FALHOU`). (2) A segunda montagem da mesma exportação é recusada (`journalctl -u mnt-arquivo-leitura-numerico.mount` diz *busy*): o instalador para no passo 1/4, e o diagnóstico NÃO é voltar ao bloco 3. Remédio: o respondedor (M3b) usa a montagem de escrita com `ReadOnlyPaths=/mnt/arquivo/escrita` na unidade do serviço, e as unidades `mnt-arquivo-leitura-*.mount` ficam desligadas: `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-pb-cp10.sh`. Registrar no ledger; o item 18 fecha pelo `ReadOnlyPaths`.

### Plano B do rclone: a 1.60.1 do sistema não decifra o que o TrueNAS grava

Só se o bloco 10 der `FALHOU-CIFRA` com o cofre conferido (a senha e o sal digitados são os mesmos do TrueNAS). Binário oficial: `VERSAO=<a que o rclone version do shell do TrueNAS mostrar, ou a mais nova> bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-pb-rclone.sh`. O `SHA256SUMS` baixado do mesmo servidor só confere a transferência, não a autoria; por isso o script verifica a **assinatura** (`gpgv --keyring`, só com a chave conferida) com a chave pública oficial, que o controlador põe em `m3a/rclone-chave-publica.asc` depois de conferir a impressão digital com o dono (NÃO VERIFICADO: o endereço e a impressão digital; sem o arquivo o script para), e só então `sha256sum -c`. `/usr/local/bin` vem antes de `/usr/bin` no PATH do Ubuntu. Repetir o bloco 10.

### Desfazer a M3a inteira (só se o dono desistir; nada aqui apaga dado, porque não há dado)

- B2 (clique): revogar as três chaves de aplicação do arquivo; apagar o bucket do arquivo (só tem sentinelas e provas).
- TrueNAS (clique): apagar a tarefa "site-arquivo -> B2 (COPY)", as duas exportações e os três datasets. A exclusão `site-arquivo/**` na tarefa "appdata -> B2" pode ficar: sem a pasta, ela não faz nada.
- Forja: `CONFIRMAR=sim bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-desfazer-forja.sh` (desliga e remove as quatro montagens, apaga `/opt/arquivo` e `~/.config/rclone`).
- Banco (Mac): `CONFIRMAR=sim bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-desfazer-banco.sh` (revoga só as três `forja (arquivo ...)` e mostra quais; **nunca** a `forja (fila)` nem a de leitura).
- healthchecks.io (clique): apagar as três verificações "Arquivo: ...".

### Trocar a chave de API de um programa do arquivo (rotação; não é da M3a)

O `seed_chave_forja.sh` dos modos do arquivo nunca revoga. Rotação de UMA chave: `bash .../m3a/m3a-rotacao-chave.sh <programa>` (revoga só a dele, com `returning name`: tem de mostrar exatamente uma linha, e guarda a velha como `.velha` na forja), `bash .../m3a/m3a-8-chaves.sh` (gera a nova) e `bash .../m3a/m3a-rotacao-chave.sh <programa> apagar-velha`. `<programa>` é o único lugar a trocar; o arquivo recusa qualquer nome fora dos três.

### Forja roubada ou perdida (spec 02 §11.1)

Revogar pelo painel do B2 a chave de leitura da forja (as outras duas continuam); revogar no banco as três chaves `forja (arquivo ...)` (`m3a-desfazer-banco.sh`). Trocar a senha da cifra não é rotina: obrigaria a regravar o arquivo inteiro. **A chave de escrita do TrueNAS** (R29): se foi criada pelo painel como "Read and Write", ela leva `deleteFiles`, e uma casa comprometida apaga versões do B2 de vez; os 30 dias protegem só contra sobrescrita.
````

- [ ] **Step 10: `m3a-progresso.md` (ledger)**

```markdown
# M3a (casa): ledger

Plano: `docs/superpowers/plans/2026-10-14-manutencao-nas-m3a-casa.md`. Uma linha por bloco, com a saída. Nunca segredo aqui: onde está, nunca o quê.

| Bloco | Quando (hora real) | Saída em `saidas/` | Resultado |
|---|---|---|---|
| 0 leituras antes | | | |
| 1 cofre e exclusão | | (clique) | |
| 2 B2 e healthchecks | | (clique) | |
| 3 TrueNAS | | (clique) | |
| 4 sentinelas | | | |
| 5 forja | | | |
| 6 prova de escrita | | | |
| 7 Dry Run e primeira subida | | (clique) | |
| 8 chaves de API | | | |
| 9 rclone na forja | | (exceção do segredo) | |
| 10 prova pelo B2 | | | |
| 11 conferência final | | | |

## Registro

- Bucket do arquivo: (nome) — pasta `site-arquivo`. Captura de Lifecycle Settings (item 2): (caminho do arquivo da captura).
- Chaves do B2 (nome no painel, nunca o valor): escrita do TrueNAS: ; leitura do Mac: ; leitura da forja: . A de escrita foi criada **sem `deleteFiles`** (linha de comando do B2)? sim / não. Se não: R29 registrado ("uma casa comprometida apaga versões do B2 de vez; os 30 dias protegem só contra sobrescrita").
- Credencial nova no TrueNAS: (nome).
- Tarefa nova: "site-arquivo -> B2 (COPY)", 06:10, fuso do NAS: .
- Verificações no healthchecks.io: "Arquivo: copiador" (12 h, 3 h), "Arquivo: conferência do B2" (24 h, 6 h), "Arquivo: pulso" (24 h, 6 h); as URLs estão no cofre. Estado: "nova" até a M3b.
- Senha e sal da cifra: no cofre (Vaultwarden do NAS), item: . **Segunda guarda, fora do NAS e da forja (item 17):** (onde; data). Obrigatória antes do passo 17 do ensaio e do primeiro descarte real; leva também a senha da cópia do cofre que vai ao B2.
- CP10: ; CP16: numerico , texto ; CP17: PEDE-SENHA (lido pelo agente em 14/10 08:31); CP25: ; CP30: SEM-CIFRA (lido pelo agente em 14/10 08:31); CP32 (lista de versões pela chave da forja): .
- Horas: T1 (gravação de `prova-m3a`, bloco 6): ; T2 (fim do Run Now do bloco 7, passo 3): ; T3 (fim do Run Now da segunda versão): .
- Fatos para a M3b: `rclone lsjson` traz `ID` (fileId)? ; `-M` traz `upload_timestamp` ou equivalente? ; o nome cru no B2 tem sufixo `.bin`? ; **fonte do `uploadTimestamp`** (campo e versão do `rclone`; o `ModTime` do `lsjson` em `b2arq:` é igual ao mtime do NAS (T1) ou à hora de envio (T2)?) ; comando exato que restaura uma versão a partir do `fileId` (Su1) ; frase e `rc` reais do `rclone cat` para **nome ausente**, para **cifra errada** (`divergente`, §10.9) e para **sem acesso** (se algum ocorrer): .

## Conferências com data (C-1 a C-4; nada roda sozinho, o controlador lê)

| # | Quando | O que ler | Esperado |
|---|---|---|---|
| C-1 | D+1, depois das 03:20 mais a duração da "appdata -> B2" | no shell do NAS: `midclt call core.get_jobs '[["method","=","cloudsync.sync"]]' -o '{"order_by":["-id"],"limit":5}' \| python3 -m json.tool \| grep -E '"description"\|"state"\|"time_finished"'`; a listagem do destino dela, com controle positivo (uma pasta irmã conhecida lista cheia) | "appdata -> B2" em `SUCCESS`; `site-arquivo` ausente com o irmão presente. Ausente sem o irmão: inconclusivo |
| C-2 | D+1, depois das 06:10 | o job da "site-arquivo -> B2 (COPY)" | `SUCCESS` com 0 transferidos (nada mudou): aqui "SUCCESS, 0" é o certo |
| C-3 | D+1, 11:07 | o crontab da forja | nada roda (o `conferir-b2` é da M3b); sem linha nova (o md5 do bloco 11 continua igual) |
| C-4 | D+31 a partir do segundo Run Now (bloco 7, passo 4) | `rclone lsf --b2-versions` pela chave da forja em `numerico/_canario/` | **uma** versão de `prova-m3a`: prova que a regra dos 30 dias está aplicada no bucket, além da captura do item 2. Duas versões no D+32: parar, a regra não pegou |
```

- [ ] **Step 11: `LEIAME-COMANDOS.md`**

Mover a seção "AGORA: leituras do NAS (14/10/2026)" para o topo de "Já rodado (histórico)", com a anotação "(rodado em 14/10 às 00:12)", e pôr no topo a seção da Tarefa 9 ("AGORA: M3a, a casa"), que é o roteiro de blocos 0 a 11 abaixo, só com o caminho para a frente: para cada bloco, a linha que roda o arquivo ou a lista de cliques, e o "Por quê" em uma frase. As regras de cada resposta e os planos B ficam no plano e no RUNBOOK, não no LEIAME.

- [ ] **Step 12: Sem commit (controlador, 14/10)**

Os arquivos desta tarefa ficam em `.superpowers/sdd/manutencao-nas/` (os `m3a/*.sh`, o RUNBOOK, o ledger e o LEIAME), e essa pasta está no `.gitignore`: `git commit -- <caminho ignorado>` falha a linha inteira. Eles ficam só no disco desta máquina, como o resto do ledger da fase. Nada desta tarefa é commitado; o que é versionado é o kit da forja (Tarefas 1 a 6, no git local de `~/Workspace/forja/ferramentas`) e o teste do site (Tarefa 7).

---

### Task 9: A execução, bloco a bloco, pelo dono (o controlador acompanha e lê as saídas)

**Files:** nenhum de código. Lê: `saidas/m3a-*`. Escreve: `m3a-progresso.md` (uma linha por bloco).

**Interfaces:**
- Consumes: tudo das Tarefas 1 a 8, commitado.
- Produces: a casa pronta para a M3b; os itens 2, 16, 18 e 33 fechados; o 17 com a guarda do cofre feita e a segunda guarda registrada como pendente ou feita.

Regra de cada bloco: o dono roda; o controlador lê a saída e só libera o bloco seguinte se a regra "segue se" valer. **Em cada regra, primeiro o que acontece quando o dado não existe.**

- [ ] **Bloco 0. Leituras antes (Mac, só leitura)**

`bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-0-leituras-antes.sh`

Segue se: `nas-site-arquivo-nao-existe` diz `dataset does not exist`; `forja-arquivo-nao-existe` lista três "No such file"; o kit não tem mudança sem commit; o `nas-usuario` é `truenas_admin` ou `root` (outro usuário: o bloco 4 vai falhar por permissão; usar `ssh -t nas 'sudo touch ...'` no lugar, e o controlador ajusta o arquivo do bloco 4). **Dado ausente:** se `nas-fuso` vier vazio, o fuso do NAS não foi lido e a hora 06:10 do bloco 3 fica valendo como hora do NAS, registrada como NÃO VERIFICADO; se o fuso não for `America/Sao_Paulo`, o bloco 3 converte 06:10 de São Paulo para o fuso lido.

- [ ] **Bloco 1. Cofre e exclusão na tarefa antiga (cliques)**

1. **(clique, cofre)** No Vaultwarden, gerar dois valores de 64 caracteres (gerador do próprio cofre): "Arquivo do site: senha da cifra do B2" e "Arquivo do site: sal da cifra do B2". **Recomendado já, obrigatório antes do passo 17 do ensaio e do primeiro descarte:** copiar os dois para a guarda offline (papel ou pendrive fora de casa), junto da senha da cópia do cofre que vai ao B2 ("vaultwarden (snapshot) -> B2").
2. **(clique, TrueNAS)** Data Protection, Cloud Sync Tasks, "appdata -> B2", Edit, Exclude: acrescentar `site-arquivo/**`. Salvar.

Segue se: o item do cofre existe com os dois valores; a conferência do bloco 4 vai mostrar o `exclude` com `site-arquivo/**` na tarefa "appdata -> B2". **Dado ausente:** sem a exclusão gravada, nada aparece de errado agora (a pasta ainda não existe); quem pega é o Dry Run do bloco 7, que só tem valor porque roda depois de existirem arquivos na pasta.

- [ ] **Bloco 2. B2 e healthchecks (cliques)**

1. **(clique, B2)** Buckets, Create a Bucket: nome à escolha do dono (sugestão: `tnf-site-arquivo-` mais 3 caracteres aleatórios; nomes do B2 são únicos no mundo), **Private**, Default Encryption ligada (como o atual), **Object Lock desligado**. Lifecycle Settings: "Keep prior versions for this number of days: 30". Guardar a captura dessa tela (item 2).
2. **(clique, B2)** App Keys, Add a New Application Key, três vezes, cada uma com "Allow access to Bucket(s)" = o bucket do arquivo:
   - "truenas-site-arquivo-escrita": **sem `deleteFiles`**. O painel não oferece essa combinação, então criar pela linha de comando do B2, no Mac: `b2 key create --bucket <bucket> truenas-site-arquivo-escrita listBuckets,listFiles,readFiles,writeFiles`. O valor vai ao TrueNAS e ao cofre. Se a verificação da credencial no TrueNAS recusar, ou se o dono não quiser a linha de comando: "Read and Write" pelo painel, **e** o ledger e o R29 registram que "uma casa comprometida apaga versões do B2 de vez; os 30 dias protegem só contra sobrescrita". Cadastrar no TrueNAS (Credentials, Backup Credentials, Cloud Credentials, Add, provedor Backblaze B2) como "B2 site-arquivo (escrita)". NÃO VERIFICADO: se a tarefa `COPY` do TrueNAS 25.10.4 pede `deleteFiles` em algum caminho, por exemplo ao cancelar um envio grande; o Run Now do bloco 7 é a prova.
   - "mac-site-arquivo-leitura", Read Only. Só no cofre.
   - "forja-site-arquivo-leitura", Read Only. Só no cofre (o bloco 9 a leva para a forja).
3. **(clique, healthchecks.io)** Três verificações, sem pingar nenhuma: "Arquivo: copiador" (período 12 h, folga 3 h), "Arquivo: conferência do B2" (24 h, 6 h), "Arquivo: pulso" (24 h, 6 h). As três URLs vão para o cofre.

Segue se: o bucket existe, privado, sem Object Lock, com 30 dias; as três chaves existem com o bucket restrito; as três verificações aparecem como "nova" (sem sinal). **Dado ausente:** uma verificação que nunca recebe sinal fica "nova" e não avisa nada; é por isso que a M3b só se dá por instalada vendo cada uma sair de "nova". NÃO VERIFICADO: se o healthchecks.io trata "nova" como sem alerta (é o comportamento documentado do serviço); se alguma aparecer "down" antes do primeiro sinal, pausar até a M3b.

- [ ] **Bloco 3. TrueNAS: datasets, permissões, exportações e a tarefa nova (cliques)**

O nome exato de um campo pode variar na 25.10.4; o que vale é o valor.

1. **(clique)** Datasets, `fast/appdata`, Add Dataset: `site-arquivo`; cifra herdada do pai; Quotas, "Quota for this dataset and all children" (`quota`): 20 GiB.
2. **(clique)** Em `site-arquivo`, Add Dataset: `numerico`, "Quota for this dataset" (`refquota`): 10 GiB. De novo: `texto`, 10 GiB.
3. **(clique)** Em cada um dos três, Edit Permissions: dono `truenas_admin`, grupo `truenas_admin`, com escrita para o dono.
4. **(clique)** Shares, NFS, Add: `/mnt/fast/appdata/site-arquivo/numerico`; Hosts `100.89.6.27`; Mapall User `truenas_admin`, Mapall Group `truenas_admin`; sem Read Only. De novo para `/mnt/fast/appdata/site-arquivo/texto`. **Nenhuma exportação de `site-arquivo`.**
5. **(clique)** Data Protection, Cloud Sync Tasks, Add: Description "site-arquivo -> B2 (COPY)"; Direction PUSH; Transfer Mode **COPY**; Directory `/mnt/fast/appdata/site-arquivo`; Credential "B2 site-arquivo (escrita)"; Bucket o do bloco 2; Folder `site-arquivo`; Remote Encryption **ligada**, Encryption Password e Encryption Salt **copiados do cofre**; Filename Encryption **desligada**; Exclude `**/_recebendo/**`; Take Snapshot desligado; Schedule personalizado `10 6 * * *` (06:10, todo dia; ajustado pelo fuso do bloco 0). Salvar **sem** Dry Run (a pasta ainda está vazia: o Dry Run de agora listaria nada e passaria em qualquer caso).

Segue se: a leitura do bloco 4 confirma. **Dado ausente:** `refquota` em `none` num filho quer dizer que o alarme de 80% e o "NAS cheio" nunca disparariam; corrigir antes do bloco 5.

- [ ] **Bloco 4. Sentinelas e leitura do bloco 3 (Mac → NAS)**

`bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-4-nas-sentinelas.sh`

Segue se, na saída: `datasets` mostra `site-arquivo` com `quota` 20G e os dois filhos com `refquota` 10G, cifra `aes-256-gcm` nos três, `encryptionroot` = `fast/appdata` nos três e `keystatus` = `available` (um filho com senha própria também mostra `aes-256-gcm`, mas fica trancado depois de cada reinício); `donos` mostra o uid de `truenas_admin` nos três (o uid lido no bloco 0); `tarefas-b2` mostra a "appdata -> B2" com `site-arquivo/**` no `exclude`, e a nova com `"transfer_mode": "COPY"`, `"encryption": true`, `"filename_encryption": false`, `**/_recebendo/**` no `exclude`, `"path": "/mnt/fast/appdata/site-arquivo"`, hora 6 e minuto 10; **nenhuma outra tarefa** com `path` que contenha `/mnt/fast/appdata/site-arquivo`, salvo a "appdata -> B2" com a exclusão; `nfs` mostra as duas exportações dos filhos com `hosts` `100.89.6.27`, `mapall_user` `truenas_admin`, `ro` falso, e nenhuma de `/mnt/fast/appdata/site-arquivo` sozinho. **Dado ausente:** se o `grep` não achar `exclude` na tarefa antiga, a exclusão não foi salva: voltar ao bloco 1, passo 2.

- [ ] **Bloco 5. Forja: montagens, `/opt/arquivo`, ferramentas e `rclone` (Mac → forja; uma senha de `sudo`)**

`bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-5-forja-instalar.sh`

Segue se: o instalador termina em `4/4 pronto: rclone v1.60...`; `montagens-CP10` mostra as quatro, cada `SOURCE` terminando no nome do filho, as de escrita com `rw` e as de leitura com `ro`, todas `soft`; `ponto-de-montagem` diz "is a mountpoint" quatro vezes; `sentinelas` lista as quatro (as duas do NAS, vistas pelas quatro montagens); `opt-arquivo` mostra `700 thiago /opt/arquivo/chaves`; `obscure-pela-entrada` maior que 1. **Dado ausente:** com `nofail`, uma montagem que não subiu deixa o diretório local vazio e o `ls` da sentinela dá "No such file": é a prova de que a montagem falta, nunca "arquivo apagado". Se o `enable --now` falhar, o instalador para; olhar `ssh forja 'systemctl status mnt-arquivo-escrita-numerico.mount --no-pager | tail -5'` e `journalctl -u mnt-arquivo-leitura-numerico.mount`: se a falha é de uma montagem de **leitura** com *busy*, é a segunda forma do plano B do CP10 (RUNBOOK), não a exportação; se é de escrita, voltar ao bloco 3 (exportação). `opt-arquivo` mostra também `755 thiago /opt/arquivo/estado`.

- [ ] **Bloco 6. Prova de escrita (CP16), prova da leitura (CP10) e arquivos de prova (Mac → forja e NAS)**

`bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-6-prova-escrita.sh`

A regra para cada resposta (spec 01 CP16):

| Resposta | O que fazer |
|---|---|
| `CP16-numerico: OK` e `CP16-texto: OK` | Seguir com dois filhos |
| `PARE-CP16-<filho>` | **Parar.** A forja gravou por baixo da montagem. Plano B do RUNBOOK (dataset único) e repetir os blocos 3 a 6 |
| `touch` da escrita falha por permissão | Conferir o dono do dataset (bloco 3, passo 3) e repetir |
| `CP10-<filho>: OK` | Item 18 fecha pelo `ro` |
| `CP10-<filho>: FALHOU` | Plano B do CP10 no RUNBOOK; o item 18 fecha pelo `ReadOnlyPaths` na M3b |
| `PARE-CP10-<filho>` ou `mountpoint` da leitura falha | A leitura não montou, ou o `touch` falhou por outro motivo que não *Read-only file system*: não é prova de que o `ro` funciona. Plano B do CP10 (segunda forma) no RUNBOOK |

**Dado ausente:** o `mountpoint -q` abre cada filho, na escrita e na leitura: sem ele, um `touch` daria certo no disco local e só a leitura no NAS o desmentiria, e uma leitura não montada recusaria o `touch` por permissão e passaria como se o `ro` funcionasse. O script também grava `_recebendo/prova-exclusao` (512 bytes) em cada filho: é o dado que a exclusão `**/_recebendo/**` tem de deixar de fora no bloco 7. Anotar no ledger a hora T1 da gravação.

- [ ] **Bloco 7. Dry Run das duas tarefas, a primeira subida e a segunda versão (cliques e um arquivo de comandos)**

1. **(clique)** "appdata -> B2", Dry Run. Agora há seis arquivos na pasta (duas sentinelas, duas provas e duas provas de exclusão): um Dry Run sem eles provaria nada. **Segue se** a saída do Dry Run termina com a linha de resumo do `rclone` (`Transferred:`/`Checks:`) **e** nenhuma linha cita `site-arquivo`. Sem a linha de resumo, o log veio cortado: não vale como prova, e fica valendo só a conferência C-1 (D+1, depois das 03:20). **Por que importa:** o `rclone sync` sem `--delete-excluded` não apaga do destino o que passa a ser excluído depois; se a exclusão não pegar, a passada das 03:20 sobe o arquivo inteiro para o bucket antigo, e corrigir a exclusão não limpa nada (terceira cópia, com texto de comentário de terceiros, fora do alcance do expurgo, para sempre).
2. **(clique)** "site-arquivo -> B2 (COPY)", Dry Run. **Segue se** lista exatamente `numerico/.arquivo-vivo`, `texto/.arquivo-vivo`, `numerico/_canario/prova-m3a` e `texto/_canario/prova-m3a`, nada fora de `site-arquivo`, e **não** lista `numerico/_recebendo/prova-exclusao` nem `texto/_recebendo/prova-exclusao` (os dois existem: um Dry Run que os listasse provaria que a exclusão falhou).
3. **(clique)** "site-arquivo -> B2 (COPY)", Run Now. **Segue se** o estado termina em SUCCESS com 4 arquivos (não 6: com 6, a exclusão de `_recebendo` falhou e os dois arquivos parciais subiram). **Dado ausente:** "SUCCESS, 0 arquivos" quer dizer que a origem está vazia ou errada; voltar ao bloco 3, passo 5. Anotar no ledger a hora do fim (T2): o bloco 6 gravou `prova-m3a` em T1 e o Run Now roda minutos depois.
4. **(dono)** `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-7-segunda-versao.sh` (grava uma segunda versão de `numerico/_canario/prova-m3a` e imprime o sha256 novo lido no NAS e a hora), e **(clique)** "site-arquivo -> B2 (COPY)", Run Now de novo. **Segue se** SUCCESS com 1 arquivo. É a prova mais barata que vai existir da restauração por versão (Su1) e dá a data de partida da conferência C-4.

- [ ] **Bloco 8. Três chaves de API (Mac → forja e banco de produção)**

`bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-8-chaves.sh`

Segue se: cada seed termina em `conferencia: ok (1 ativa(s), permissoes archive_...)`; `stat` mostra `700` na pasta e `600` nas três chaves, do `thiago`; a consulta lista `forja (arquivo conferidor) {archive_b2} t`, `forja (arquivo copiador) {archive_copy} t`, `forja (arquivo respondedor) {archive_read} t`, a `forja (fila)` ainda ativa, e **nenhuma linha com `revogada_em` de hoje**. **Dado ausente:** sem `/opt/arquivo/chaves` (bloco 5 não rodou), o `nova_chave_arquivo.py` para com "não existe" e nada vai ao banco. Hoje (E19 em modo aviso) as três leem as rotas de leitura como qualquer chave sem `read`, e cada leitura fica no `audit_log`; nenhuma escreve, pega tarefa ou entra no MCP (Tarefa 7). Elas só saem da forja se a forja for comprometida, e a forja já guarda uma chave `read`.

- [ ] **Bloco 9. `rclone` na forja a partir do cofre (exceção do segredo: o dono digita)**

Uma linha, no terminal do Mac, com o cofre aberto ao lado:

```
ssh -t forja 'python3 /opt/arquivo/ferramentas/configurar_rclone.py'
```

O programa pergunta, nesta ordem: o bucket, a pasta (`site-arquivo`), o keyID da chave "forja-site-arquivo-leitura" e, sem mostrar, a applicationKey dela, a senha e o sal da cifra **copiados do cofre** (nunca da tela do TrueNAS). Segue se termina em `ok: ... remotos b2arq: e arq:`. **Dado ausente:** se já existir configuração, ele recusa antes de perguntar; para refazer, `--trocar`.

- [ ] **Bloco 10. A prova pelo B2 (Mac → forja, só leitura)**

`bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-10-prova-b2.sh`

| Resposta | O que quer dizer | O que fazer |
|---|---|---|
| `PROVA-numerico: OK` e `PROVA-texto: OK` | O cofre e o TrueNAS têm a mesma chave, a 1.60.1 decifra o formato do TrueNAS, e a chave da forja lê o bucket certo. O lado "NAS" é lido no NAS | Seguir |
| `FALHOU-CIFRA` | O B2 respondeu e o `crypt` autenticou mal: a senha ou o sal da forja não são os do TrueNAS (a cifra errada dá ERRO, nunca conteúdo diferente) | Conferir que a senha e o sal do TrueNAS foram colados do cofre (Edit da tarefa) e refazer o bloco 9 com `--trocar`. Se os dois batem com o cofre, plano B do rclone no RUNBOOK |
| `FALHOU-CAMINHO` | Bucket, pasta ou arquivo não encontrado, ou a tarefa não subiu | Conferir o bloco 7, passo 3, e o bucket e a pasta do bloco 9 |
| `FALHOU-CHAVE-B2` | 401/403 do B2 | Refazer o bloco 9 com a chave "forja-site-arquivo-leitura" conferida no painel |
| `PROVA: FALHOU (nas=... b2=...)` | Nenhuma das causas acima casou | Ler o `erro-do-rclone-<filho>` cru; o controlador registra a frase real e ajusta as palavras do `grep` (NÃO VERIFICADO na 1.60.1) |
| `CONTROLE-NEGATIVO: FALHOU` | O verificador diz "presente" para o que não existe | **Parar** e investigar antes da M3b: é o modo de quebra do `conferir-b2` |
| `CONTROLE-NEGATIVO: INCONCLUSIVO` | O erro não foi "não encontrado" (B2 fora do ar, chave errada, `rclone.conf` ausente): "não consegui ler" não é "não existe" | **Parar.** O controle só vale com erro de *not found*; levar à M3b: o `conferir-b2` precisa de outra forma de separar ausente de sem acesso (por exemplo, listar a pasta e procurar o nome) |
| `PARE: rclone.conf sem remoto crypt` | O bloco 9 não rodou | Bloco 9 |
| `conf-permissoes` diferente de `700` e `600` | A chave da cifra está legível por outros usuários da forja | `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-10a-permissoes.sh` (escrita na forja, arquivo de comandos) e repetir o bloco |

**Duas versões de `prova-m3a` em `numerico` (I-5).** **Segue se** `versoes-ids-numerico` mostra duas versões de `prova-m3a` com dois `ID` distintos, a atual decifra para o sha256 novo (o da `m3a-7-segunda-versao`) e a antiga (`versao-antiga-decifra`) para o sha256 do bloco 6. O ledger registra o comando exato que restaura uma versão a partir do `fileId`: é a interface da M3b para o §10.10. Uma versão só, ou a antiga sem decifrar, é **parar**: o Su1 não tem caminho na 1.60.1.

**Portão para a M3b (`uploadTimestamp`).** O ledger registra de onde sai o `uploadTimestamp` na 1.60.1. Se o `ModTime` do `lsjson` em `b2arq:` for igual ao mtime do arquivo no NAS (T1) e não a T2, o `ModTime` **não serve**. Valem só um campo de metadado com a hora de envio (`-M`) ou o carimbo do nome de versão (`--b2-versions`), conferido contra T2. Se nenhum dos dois trouxer T2, aplicar o plano B do `rclone` (binário oficial) **ainda na M3a** e repetir o bloco 10.

O controlador registra no ledger, das seções `b2-cru-*`: se o `lsjson` traz `ID` (é o `fileId` que a M3b informa e que o site guarda da última conferência boa: Su1), o que o `-M` traz sobre a hora de envio, e se o nome cru termina em `.bin`; da `b2-versoes-CP32-*`, se a chave da forja lista versões ou devolve erro (CP32), lembrando que com uma versão só a listagem é igual à comum (a prova de versões é a do parágrafo acima); e, das linhas `neg-<filho>` e `erro-do-rclone-<filho>`, o `rc` e a frase reais do nome **ausente** e de qualquer erro de cifra ou acesso que apareça.

- [ ] **Bloco 11. Conferência final (Mac; um passo de escrita antes, depois só leitura)**

Antes: `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-11a-limpar-prova-exclusao.sh` (apaga as duas `_recebendo/prova-exclusao`, para a M3b não encontrar em `_recebendo` um resto que pareça escrita interrompida). Depois:

`bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/m3a/m3a-11-conferencia-final.sh`

Segue se: `ITEM33-forja-crontab-md5: IGUAL` e `ITEM33-forja-pulso-md5: IGUAL` (a fila não mudou: mesma linha de cron e mesmo pulso, item 33); `FERRAMENTAS-IGUAIS` e `UNIDADES-IGUAIS`; `item16-arquivos` lista só as duas sentinelas e as duas provas (nada em `_recebendo`); `item16-datasets` mostra `encryptionroot` `fast/appdata` e `keystatus` `available` nos três; `uso-das-chaves-arquivo` mostra `leituras` = 0 (ninguém usou as chaves do arquivo; qualquer outro número é parar e investigar); o resto como nos blocos 4, 5 e 8. A comparação do item 33 só vale com as duas linhas lidas e sem o md5 de nada (`d41d8cd9...`): duas falhas iguais não são "IGUAL". **Dado ausente:** se o arquivo do bloco 0 não existir, a comparação imprime `MUDOU (antes= ...)`: rodar o bloco 0 de novo não serve (já mudou o que tinha de mudar); comparar à mão com as quatro linhas de cron de `01` F35 e do fato lido em 14/10.

- [ ] **Fecho: registrar no ledger e avisar**

Preencher `m3a-progresso.md` (inclusive a tabela "Conferências com data", C-1 a C-4: nenhuma roda sozinha, o controlador as lê nas datas); marcar no índice dos planos a M3a como feita; avisar que a M3b pode começar quando a M2 estiver em produção (`00-indice` dos planos, linha 5).

---

## Itens de aceite que a M3a fecha, e onde

| Item | Onde fecha |
|---|---|
| 2 (captura de Lifecycle Settings) | Bloco 2, passo 1; caminho no ledger |
| 16 (datasets, `refquota`, exportações, tarefa `COPY`, exclusão, CP16) | Blocos 4, 6, 7 e 11 |
| 17 (cofre e segunda guarda) | Bloco 1: a parte do cofre; a segunda guarda fica registrada como pendente até ser feita, e é condição do passo 17 do ensaio e do primeiro descarte real |
| 18 (quatro montagens `soft`, leitura recusa escrita, sentinela nas quatro) | Blocos 5, 6 e 11 |
| 33 (a fila não mudou) | Bloco 11 |
| 134, parte do kit ("o `pulso.sh` tem blocos próprios ... nenhum usa o registro nem a verificação da fila") | Tarefa 6 (teste); a instalação e o resto do item são da M3b |

## O que fica NÃO VERIFICADO depois do plano (e quem prova)

- Nome exato dos campos na tela do TrueNAS 25.10.4 e do B2: o valor é o que vale; a leitura dos blocos 4 e 11 prova.
- Se o `rclone` 1.60.1 decifra o que o TrueNAS grava (CP25): bloco 10.
- Se o cliente NFS aceita a mesma exportação em `rw` e `ro` (CP10): bloco 6.
- Se a exportação do pai mostraria os filhos: não se testa; o desenho exporta só os filhos e o bloco 6 prova que a escrita cai no filho.
- Se o `rclone lsjson` da 1.60.1 traz o `fileId`, e o nome cru com `.bin`: bloco 10, registrado para a M3b.
- Formato exato do keyID e da applicationKey do B2: o `configurar_rclone.py` aceita uma faixa larga; o bloco 10 prova a chave.
- Se o healthchecks.io deixa a verificação "nova" sem alerta: bloco 2.
- O usuário do `ssh nas` e a permissão dele no dataset: bloco 0 e bloco 4.
- Código de saída e frase do `rclone` 1.60.1 para nome ausente, cifra errada e sem acesso: bloco 10 (`neg-<filho>`, `erro-do-rclone-<filho>`).
- Fonte do `uploadTimestamp` (`-M` no B2 da 1.60.1, carimbo do nome de versão): bloco 10, com o portão para a M3b.
- Se a restauração por versão (`--b2-versions` por nome de versão, através do `crypt`) funciona na 1.60.1: bloco 10, `versao-antiga-decifra`.
- Se a tarefa `COPY` do TrueNAS pede `deleteFiles`: bloco 7, Run Now.
- A assinatura do `SHA256SUMS` do `rclone` e a impressão digital da chave pública: só no plano B do rclone.

## Dependências

- **De outra etapa:** nenhuma trava a M3a (`00-indice` dos planos: "pergunta 1 (respondida); CP25"). A M3b depende desta.
- **De outra trilha:** nenhuma.
- **O que a M3b herda daqui:** a seção "Interfaces registradas para a M3b"; o passo "o dono cola a chave no `.env`" do `05` §16.5 sai (a chave já está em `/opt/arquivo/chaves/`); o `install -d` de `/opt/arquivo` da M3b vira repetição sem efeito; a instalação dos blocos do pulso com `pulso_arquivo.py`; a confirmação de que cada verificação saiu de "nova".
