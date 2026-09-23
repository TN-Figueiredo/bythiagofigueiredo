# Runbook — fila de inteligência do YouTube na forja

> Corrente completa: cron de 10 min na forja → claim em `/api/pipeline/youtube/intelligence/task/claim`
> → snapshot → Gemma 12B local → validador → `PATCH …/intelligence` → Health Coach do CMS.
> Vigilância: uma linha jsonl por execução → bloco no `pulso.sh` → check `URL_FILA` no healthchecks.
> Spec: `docs/superpowers/specs/2026-09-18-forja-fila-inteligencia-design.md`.
> Plano: `docs/superpowers/plans/2026-09-19-forja-fila-inteligencia-plan.md`.
> O que de fato aconteceu na execução: `.superpowers/sdd/2026-09-19-forja-fila-inteligencia-plan/progress.md`.

**Em produção desde 2026-09-22** (crontab instalado 17:59 BRT; primeira execução automática 18:00:05,
`desfecho: vazia`, que é o resultado sadio quando não há task de PT pendente).

**Regra do dono, válida para tudo neste arquivo: comandos curtos, um por linha.** Uma linha longa
com `env -u … -u … VAR=v python -B script` já quebrou no terminal dele — o `env -u` virou comando
próprio e o `python -B` sozinho abriu um REPL.

---

## 1. O que é e onde roda

| | |
|---|---|
| Máquina | Ubuntu na casa do dono, acesso por `ssh forja`, usuário `thiago` |
| Agendador | **crontab do `thiago`** — não é systemd, não é root, não é cron do Vercel |
| Worker | `/opt/agente/docs/trilha/fila_intel.py` — **cópia única**, roda direto de onde o `scp` do kit a deixa |
| Interpretador | `/opt/agente/venv/bin/python` (tem `httpx`; o `python3` do sistema **não** tem) |
| Módulo do site | `/opt/agente/docs/sitio.py` (fase 2, `ROTAS_FASE` = `[1, 2]`) |
| Trava | `/opt/agente/fila_intel.lock` — `flock` exclusivo, não-bloqueante no worker |
| Segredo + canais | `/opt/agente/fila_intel.env`, `thiago:thiago` **0600**, nenhuma unit o carrega |
| Uuid dos canais e chave `{read}` | `/etc/default/proxy-agente` (`SITIO_CANAL_PT`, `SITIO_CANAL_EN`, `SITIO_CHAVE`) |
| Log estruturado | `/opt/agente/log/fila_intel.jsonl` — **uma linha por execução com lock** |
| Traceback | `/opt/agente/log/fila_intel.err` — só enche quando o worker morre antes do lock |
| Sombras | `/opt/agente/sombra/<CANAL>-<AAAAMMDDThhmmss>.json` |
| Pulso | `/opt/agente/docs/pulso.sh`, de hora em hora; bloco entre `# >>> fila_intel (F4)` e `# <<< fila_intel (F4)` |
| Check | `URL_FILA` no healthchecks.io — **Simple, período 1 h, grace 45 min**. Separado do principal (`Forja — Agente`) de propósito: uma task reprovada não pode calar um proxy caído |
| Chave no site | `pipeline_api_keys` com `name = 'forja (fila)'`, permissões `{read,intelligence}` |
| Escopo da fase 2a | só **views e séries** — sem CTR, sem retenção, sem recomendação por vídeo |

### A linha viva do crontab

```
*/10 * * * * AGENTE_SITIO=/opt/agente/docs/sitio.py timeout -k 30s 25m /opt/agente/venv/bin/python -B /opt/agente/docs/trilha/fila_intel.py --cron >>/opt/agente/log/fila_intel.err 2>&1
```

**O prefixo `AGENTE_SITIO=` é obrigatório hoje.** O worker instalado é anterior ao commit `646447e`
do kit, que fez `carregar_sitio()` procurar `sitio.py` no diretório **pai** (`/opt/agente/docs/`).
Sem o prefixo, o worker instalado procura `/opt/agente/docs/trilha/sitio.py`, que não existe, e
cai em traceback a cada 10 min — foi exatamente o crashloop de 22/09. Veja a §2.

O prefixo deixa de ser necessário **no dia em que o worker da forja for atualizado para uma versão
≥ `646447e`**. Prova, antes de tirar o prefixo:

```
ssh forja 'grep -c "dirname(os.path.dirname" /opt/agente/docs/trilha/fila_intel.py'
```

`1` = já tem o conserto, o prefixo pode sair. `0` = **mantenha o prefixo**.

### Onde entra o tempo

Orçamento do worker: 20 min a partir do claim, sob `timeout -k 30s 25m` do cron, e ainda 9 min
abaixo do `STALE_THRESHOLD_MINUTES` (30 min) do watchdog do site. **Mexer em qualquer um dos três
exige refazer essa conta** — inclusive no limiar de 70 min do pulso.

O worker **não clama** entre 11:45 e 12:05 UTC: é a janela do sync de analytics, e um claim ali
leria `views_90d` parcial. Sai `ocupado` com `motivos: janela_sync`.

---

## 2. Estado real instalado — a deriva conhecida (conferida em 2026-09-22)

Antes de reinstalar ou depurar qualquer coisa, saiba o que de fato está na máquina.

**O kit do Mac está à frente da forja.** **Não confie numa lista escrita aqui — rode o portão.**
Em 22/09 o número de commits não instalados passou de 2 para 4 em três horas, porque outros
terminais continuaram commitando no kit. A autoridade é o `KIT-IGUAL` do card K, e ele é só leitura:

```
cd ~/Workspace/forja/ferramentas
```
```
{ (cd docs && find sitio.py trilha -type f ! -path '*__pycache__*' | sort | xargs md5 -r); (cd fase2 && md5 -r pulso_f4.py teste_pulso_fila.py); } | sed 's/ /  /' | ssh forja 'cd /opt/agente/docs && md5sum -c --quiet' && echo KIT-IGUAL
```

Saída vazia + `KIT-IGUAL` = a forja está em dia. Cada linha `FAILED` nomeia um arquivo que chegou
diferente (ou nunca chegou). **Medido em 22/09 23:10:** `sitio.py` igual; reprova em
`trilha/fila_intel.py`, `trilha/teste_fila.py`, `trilha/teste_fila_redacao.py`,
`trilha/teste_calculo.py`, `trilha/capturar_fixture.py`, `trilha/nova_chave.py`, `pulso_f4.py` e
`teste_pulso_fila.py` — e `/opt/agente/series.json` ausente.

O que cada commit não instalado custa, para saber o que esperar antes de atualizar:

| Commit do kit | O que conserta | Efeito de não estar instalado |
|---|---|---|
| `646447e` | `carregar_sitio()` acha o `docs/sitio.py` do diretório **pai** | a linha do cron **precisa** do `AGENTE_SITIO=` |
| `3dde429` | `--sombra` sem `--snapshot` cai na fixture, igual ao `--canario` | `--sombra` sem a flag estoura `TypeError` → `desfecho: bug` |
| `d9f1079` | `capturar_fixture.py` usa a chave **da fila**, não a `{read}` da fase 1 | a captura da fixture (§2, receita do `series.json`) pode ir com a chave errada |
| `591e7c8` | `dias_sem_publicar` sem sinal; coorte sem os `view_count` não importados | `-1 dias sem publicar` no texto, e zeros parciais invertendo o veredito da série |
| `d3025ed` | `series_ausente`, `janela_ausente`, `fila-fallback` no pulso, `fail_*` no `indeterminado` | as quatro falhas que chegavam ao jsonl como verde continuam verdes |
| `30ed71c` / `5775278` | vídeo oculto fora de todo fato de canal; "vídeos públicos no banco" | ocultos entram na contagem e na coorte |
| `d118e9d` | o PATCH leva os números de cada série e as séries examinadas sem veredito | o card do site mostra só o texto, sem mediana/coorte/razão |
| `d592797` | `nova_chave.py` e o seed criam a chave da fila só com `intelligence` | a próxima rotação devolve o `read` largo à chave |

Depois de atualizar, `git log --oneline` no kit e o portão de novo — **o `git log` diz o que mudou,
o portão diz o que chegou.**

Para atualizar a forja (o dono cola; **nenhum agente escreve na forja**):

```
cd ~/Workspace/forja/ferramentas/docs
```
```
scp -r sitio.py trilha forja:/opt/agente/docs/
```
```
scp ~/Workspace/forja/ferramentas/fase2/pulso_f4.py forja:/opt/agente/docs/
```
```
scp ~/Workspace/forja/ferramentas/fase2/teste_pulso_fila.py forja:/opt/agente/docs/
```

O `scp -r trilha` **não** leva `fixture_pt.json` nem `series.json` — eles moram fora do kit
justamente para não serem sobrescritos.

Depois de qualquer `scp` do worker, rode o `teste_fila.py` **na forja**, sob a trava, antes de
confiar no cron (§4, passo 3).

### `series.json`: pronto no kit, ainda não na forja (22/09 23:10)

`/opt/agente/series.json` é, pelo spec §4.2, **a verdade das séries**. O do PT está no kit desde
`09f437c` (`fase2/series.json`, 28 vídeos em 5 séries: `zero-dez`, `vlogzeira`, `canada`,
`tailandia`, `main-ad-diamante`), montado com as escolhas do dono. **Na forja ele ainda não existe**
— leve-o com o passo 4 abaixo. Enquanto não existir, a consequência é: `ler_series()` devolve `{}`, `series: []`, e o núcleo analítico da
fase 2a (comparar a mediana de cada série com a coorte do mesmo ano) roda sobre nada. A saída fica
tecnicamente correta e editorialmente vazia: "Nenhuma série se afasta da coorte do mesmo período."
é verdade trivial quando não há série nenhuma. **E isso não pinta o check de vermelho** —
`desfecho: ok`.

Diagnóstico em uma linha:

```
ssh forja 'ls -l /opt/agente/series.json 2>/dev/null || echo AUSENTE'
```

Receita para criar ou refazer (o agrupamento é **decisão editorial do dono**, não do agente — vale
para o EN e para quando entrarem vídeos novos numa série):

1. Na forja, capturar a fixture, se ela não existir:
   ```
   cd /opt/agente
   ```
   ```
   venv/bin/python -B docs/trilha/capturar_fixture.py
   ```
2. Trazer a fixture ao Mac, fora do kit:
   ```
   mkdir -p ~/Workspace/forja/ferramentas/fase2
   ```
   ```
   scp forja:/opt/agente/docs/trilha/fixture_pt.json ~/Workspace/forja/ferramentas/fase2/
   ```
3. Montar `~/Workspace/forja/ferramentas/fase2/series.json` a partir dos títulos. Formato:
   ```json
   {"videos": {"<id INTERNO do snapshot>": "<slug>"}, "nomes": {"<slug>": "Nome exibível"}}
   ```
   **A chave é o `id` interno do snapshot, não o id do YouTube** (`mapa.get(v["id"])`,
   `fila_intel.py:215`). Série = 3 ou mais vídeos **maduros e não ocultos** com o mesmo slug.
4. Levar à forja:
   ```
   scp ~/Workspace/forja/ferramentas/fase2/series.json forja:/opt/agente/series.json
   ```
5. Conferir a leitura antes de esperar qualquer coisa do cron:
   ```
   cd /opt/agente
   ```
   ```
   AGENTE_SITIO=/opt/agente/docs/sitio.py venv/bin/python -B docs/trilha/fila_intel.py --escolher --snapshot docs/trilha/fixture_pt.json
   ```
   Ele imprime os vídeos **fora** do `series.json` e a saída de `escolher`.

`main-ad-diamante` está no arquivo mas os três episódios são `is_hidden` — nunca vira série, e é
de propósito: se um dia forem publicados, entram sem editar nada. `tailandia` tem 2 episódios e só
vira série no terceiro.

---

## 3. Desligar

Use quando o site estiver em manutenção, quando a chave for revogada, ou quando o worker estiver
em crashloop e você precisar de silêncio para investigar.

**Passo 1 — tirar só a linha da fila do crontab.** Nunca restaure o `crontab.bak-F4` inteiro: ele
apagaria linhas acrescentadas depois do F4.

```
crontab -l | grep -vF 'docs/trilha/fila_intel.py' | crontab -
```
```
crontab -l | grep -c fila_intel
```
```
crontab -l | grep -c -e retentar -e pulso
```

Esperado: `0` na primeira contagem e **a mesma contagem de antes** na segunda (hoje, `2`).

**Passo 2 — esperar a execução em curso terminar.** Uma execução pode segurar a trava por 25 min.

```
flock -w 1800 /opt/agente/fila_intel.lock true && echo LOCK-LIVRE || echo 'ESPERAR: execucao ainda viva'
```

Só siga com `LOCK-LIVRE` impresso. Se estourar, confira antes de forçar:

```
pgrep -af fila_intel.py
```

**Passo 3 — calar o check.** Sem ping, o `URL_FILA` fica atrasado em ~1 h e vermelho depois da
grace de 45 min, e dá alarme falso no meio do desligamento. **Pause o check no painel do
healthchecks** na mesma hora. Para desligamentos longos, tire também o bloco do pulso:

```
cd /opt/agente/docs
```
```
python3 pulso_f4.py --remover
```
```
bash -n pulso.sh.tmp
```
```
chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh
```
```
grep -c URL_FILA /opt/agente/docs/pulso.sh
```

Esperado: `0`. O `--remover` apaga do marcador de abertura ao de fechamento e exige contagem 1 de
cada; ele é fail-closed.

> Para **parar de clamar sem desmontar nada** — o desligamento mais leve — basta esvaziar a lista
> de canais: `CANAIS_FILA=""` em `fila_intel.env`. O worker passa a sair `config` a cada 10 min,
> **sem tocar no site**. Mas isso deixa o `URL_FILA` vermelho com `fila-parada:config` de propósito,
> então só use se você quiser o alarme.

---

## 4. Religar

**Passo 1 — o worker está sadio?**

```
ssh forja 'md5sum /opt/agente/docs/trilha/fila_intel.py'
```
```
ssh forja 'grep -c "dirname(os.path.dirname" /opt/agente/docs/trilha/fila_intel.py'
```

Guarde as duas respostas: a segunda decide se a linha do cron leva o prefixo (§1).

**Passo 2 — o segredo está no lugar?**

```
ssh forja 'stat -c "%a %U:%G" /opt/agente/fila_intel.env'
```
Esta terceira roda **na forja**, não por `ssh` — o escape através do `ssh` é frágil e um erro aqui
imprimiria a chave. O `sed` substitui por um `1` literal, **nunca por `\1`**: o que sai é a
contagem, jamais o valor.

```
sed -n 's/^SITIO_CHAVE_FILA="\(forja_[A-Za-z0-9_-]\{43\}\)"$/1/p' /opt/agente/fila_intel.env | wc -l
```
```
ssh forja 'grep -c SITIO_CHAVE_FILA /etc/default/proxy-agente'
```

Esperado: `600 thiago:thiago`, `1` (exatamente uma chave, no formato) e `0` (a chave da fila
**nunca** mora no `/etc/default`, que o serviço carrega no ambiente).

**Passo 3 — `teste_fila.py` verde na forja, sobre a mesma cópia que o cron vai rodar.** Um comando
por linha, sempre:

```
cd /opt/agente/docs/trilha
```
```
unset PYTHONPATH AGENTE_BASE
```
```
export AGENTE_SITIO=/opt/agente/docs/sitio.py
```
```
export AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py
```
```
flock -w 1800 /opt/agente/fila_intel.lock /opt/agente/venv/bin/python -B teste_fila.py || echo 'PARE: teste_fila reprovou ou lock ocupado por 30 min'
```

**Passo 4 — uma execução manual antes do cron.** Ela imprime o desfecho.

```
cd /opt/agente
```
```
AGENTE_SITIO=/opt/agente/docs/sitio.py timeout -k 30s 25m venv/bin/python -B docs/trilha/fila_intel.py
```

Se sair `chat`, `ocupado` ou `llama_fora`, **nada foi clamado** — espere 5 min, fora de
11:45–12:05 UTC, e repita o mesmo comando.

**Passo 5 — a linha do crontab.** Bloco inteiro, com backup e conferência contra o backup:

```
(
  crontab -l > /opt/agente/crontab.bak-F4 || { echo 'PARE: crontab -l falhou — nada foi instalado'; exit 1; }
  grep -q pulso /opt/agente/crontab.bak-F4 && grep -q retentar /opt/agente/crontab.bak-F4 || { echo 'PARE: backup do crontab sem pulso/retentar — nao instalar'; exit 1; }
  grep -q fila_intel /opt/agente/crontab.bak-F4 && { echo 'PARE: ja existe linha fila_intel no crontab'; exit 1; }
  N0=$(grep -c -e retentar -e pulso /opt/agente/crontab.bak-F4)
  (cat /opt/agente/crontab.bak-F4; echo '*/10 * * * * AGENTE_SITIO=/opt/agente/docs/sitio.py timeout -k 30s 25m /opt/agente/venv/bin/python -B /opt/agente/docs/trilha/fila_intel.py --cron >>/opt/agente/log/fila_intel.err 2>&1') | crontab -
  [ "$(crontab -l | grep -c -e retentar -e pulso)" = "$N0" ] && [ "$(crontab -l | grep -c fila_intel)" = 1 ] && echo CRON-OK || echo 'PARE: crontab divergente — restaure com  crontab /opt/agente/crontab.bak-F4'
)
```

**Passo 6 — esperar uma execução `cron` sadia** antes de reativar o check:

Na forja, numa linha só (o escape através do `ssh` quebra este aqui):

```
python3 -c "import json,sys;sys.exit(0 if any(d.get('modo')=='cron' and d.get('desfecho') in ('vazia','ok') for d in (json.loads(l) for l in open('/opt/agente/log/fila_intel.jsonl') if l.endswith('}\n'))) else 1)"; echo saida=$?
```

`saida=0` → siga. `saida=1` → espere o próximo tique de 10 min. Não reative o check antes disso:
ele entraria já vermelho.

**Passo 7 — repor o bloco do pulso**, se ele tiver sido removido na §3:

```
cd /opt/agente/docs
```
```
python3 pulso_f4.py '<url de ping do check URL_FILA>'
```
```
bash -n pulso.sh.tmp
```
```
python3 teste_pulso_fila.py pulso.sh.tmp
```
```
cp -p pulso.sh pulso.sh.bak-F4
```
```
chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh
```

O `teste_pulso_fila.py` tem de imprimir `F4: 0 falha(s)` (51 casos). O `pulso_f4.py` recusa URL
fora de `^https://hc-ping\.com/[0-9a-f-]{36}$`, recusa se os marcadores já existirem, e recusa se a
âncora `[ "$ok" -eq 1 ]` não aparecer exatamente uma vez. **Não é preciso conferir o `pulso.sh`
antes: o script é fail-closed por construção** (veja a §7 da deriva conhecida, mais abaixo).

O `mv` pode perguntar `replace 'pulso.sh', overriding mode 0755?` se o arquivo ainda for do `root`.
Responda `y`; ele passa a ser `thiago:thiago 755`, que é quem roda o cron. **Sem `sudo`, sempre.**

Por fim, **retire a pausa do check no healthchecks** e confirme visualmente os dois verdes:
`URL_FILA` e `Forja — Agente`.

---

## 5. Trocar a chave

> **Leia isto antes de colar qualquer coisa.** Numa **rotação** — não na primeira criação — o
> `seed_chave_forja.sh` **exige** `CONFIRMAR_REVOGACAO=sim`. Sem a variável ele para com `rc ≠ 0` e
> a mensagem `pare: isto revogaria N chave(s) 'forja (fila)' que ja estao ativa(s) …`.
> **Isso não é defeito — é a guarda funcionando.** Ela existe porque colar o SHA errado (o da fase 1,
> ou um SHA antigo) revogaria a chave viva.
>
> A armadilha é a **ordem**: nesse ponto a chave nova já está no `fila_intel.env` da forja e a velha
> ainda está ativa no banco. O worker passa a clamar com a chave nova, leva 401, e a fila cai em
> `desfecho: chave` a cada 10 min até você rodar o seed de novo — com o `URL_FILA` vermelho
> (`fila-parada:chave`). Se você parar aqui achando que deu errado, a fila fica parada.

**Passo 1 — trocar na forja, sob a trava.** Com o cron vivo, o `--trocar` precisa do `flock`: assim
nenhuma execução está no meio do caminho quando o arquivo é reescrito.

```
cd /opt/agente
```
```
flock -w 1800 /opt/agente/fila_intel.lock python3 docs/trilha/nova_chave.py --fila --trocar || echo 'PARE: lock ocupado por 30 min ou nova_chave recusou — veja a saida acima'
```

Ele reescreve **só** a linha `SITIO_CHAVE_FILA=` (o `CANAIS_FILA` sobrevive), recusa se o arquivo
não for 600, e imprime o **SHA-256** da chave nova e o SQL com `'forja (fila)'` e
`array['read','intelligence']`. **Copie o SHA. O valor da chave nunca sai da forja.**

**Passo 2 — semear no site, com a confirmação, no mesmo minuto.** No Mac, na raiz do repo do site:

```
CONFIRMAR_REVOGACAO=sim bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh fila <sha256>
```

O script grava a chave nova, revoga **no mesmo SQL** toda outra `'forja (fila)'` ativa **do site**
com `key_hash` diferente, e só então confere que restou exatamente uma ativa — ou para.

Se você rodar **sem** a variável e receber o `pare:`, nada foi alterado no banco. Leia a mensagem:
ela diz quantas chaves seriam revogadas e quando foram criadas. Se o número bate com o que você
espera (numa rotação normal: `1`), repita o comando **com** `CONFIRMAR_REVOGACAO=sim`. Se o número
for maior que o esperado, **pare de verdade** — o SHA pode ser o errado.

**Passo 3 — provar.** A janela de 401 se fecha sozinha no primeiro claim depois do seed; o pulso
limpa o motivo na primeira linha `cron` com `claim` em (200, 204).

```
ssh forja 'tail -1 /opt/agente/log/fila_intel.jsonl'
```

Esperado, no próximo tique: `"desfecho": "vazia"` ou `"ok"`, com `"claim": 204` ou `200`.
Enquanto vier `"desfecho": "chave"`, o seed não fechou.

Higiene, depois de qualquer mexida no `/etc/default/proxy-agente`:

```
ssh forja 'grep -cE "^SITIO_(CHAVE|CANAL_PT|CANAL_EN)=" /etc/default/proxy-agente'
```
```
ssh forja 'grep -c SITIO_CHAVE_FILA /etc/default/proxy-agente'
```

Esperado: `3` e `0`. E a prova de que a chave nunca vazou para log nenhum:

Também **na forja**, não por `ssh`. Aqui o `\1` é obrigatório — é ele que alimenta o `grep` com o
valor a procurar —, e por isso o valor **nunca** vai para argv: ele passa só pelo `<(...)`, e a
saída é uma contagem de arquivos.

```
grep -rlFf <(sed -n 's/^SITIO_CHAVE_FILA="\(.*\)"$/\1/p' /opt/agente/fila_intel.env) /opt/agente/log/ /opt/agente/sombra/ | wc -l
```

Esperado: `0`.

---

## 6. Adicionar o canal EN

A lista de canais vive em **`CANAIS_FILA`**, no `/opt/agente/fila_intel.env`, **separada por
vírgula**, sem espaço obrigatório:

```
CANAIS_FILA="PT,EN"
```

O rótulo (`PT`/`EN`) é traduzido para uuid por `SITIO_CANAL_PT` / `SITIO_CANAL_EN`, lidos de
`/etc/default/proxy-agente` pelo próprio Python. **Rótulo desconhecido, uuid ausente ou lista vazia
→ `desfecho: config`, sem claim.**

**O que mais é exigido antes de ligar o EN** — nenhum destes é opcional:

1. **`SITIO_CANAL_EN` presente e correto.** Prova:
   ```
   ssh forja 'grep -c "^SITIO_CANAL_EN=" /etc/default/proxy-agente'
   ```
   Esperado `1`. (Conferido em 22/09: as três linhas existem.)
2. **≥ 8 vídeos no canal EN no banco do site.** É o portão que o spec §5 (F4) fixou. Em 18/09 o EN
   tinha **0 vídeos**, e um canal vazio faz o `escolher` rodar sobre nada — o mesmo modo de falha do
   `series.json` ausente: saída pobre, `desfecho: ok`, check verde.
3. **Um F2 próprio** — pelo menos três rodadas de `--sombra` com um snapshot do EN, lidas e julgadas
   pelo dono, **antes** de o EN clamar de verdade. A qualidade do texto em português não transfere.
4. **Entradas do EN no `series.json`.** O arquivo é único para os dois canais e é indexado pelo `id`
   interno do snapshot; vídeos do EN sem entrada simplesmente não formam série.
5. **Refazer a conta do orçamento.** Uma execução processa **uma** task; o claim leva os uuids de
   todos os canais de `CANAIS_FILA`. Com dois canais, a fila drena na metade da velocidade, e
   `2 × 25 min` continua tendo de caber no limiar de 70 min do pulso e no `STALE_THRESHOLD_MINUTES`
   de 30 min do watchdog.

Depois de editar o `fila_intel.env`, confira que o arquivo continua 600 e que há exatamente uma
linha `CANAIS_FILA` e uma `SITIO_CHAVE_FILA` — **duas linhas de chave fecham a porta**
(`chave_duplicada` → `config`), de propósito.

---

## 7. Ler uma linha do jsonl

Uma execução com lock = **exatamente uma** linha. Uma execução que não pegou o lock não grava nada.

```
ssh forja 'tail -1 /opt/agente/log/fila_intel.jsonl'
```
```
ssh forja 'tail -20 /opt/agente/log/fila_intel.jsonl'
```

Campos: `quando` (ISO com offset local da forja), `modo` (`cron` | `manual` | `sombra` | `escolher`
| `canario`), `desfecho`, `etapa` (onde parou), `claim` (status HTTP do claim, ou `null`), `task`,
`canal`, `ms` (por etapa), `tentativas`, `seeds`, `tokens`, `fallback`, `motivos`.

**A chave nunca aparece. O texto gerado nunca aparece** — nem o do modelo, nem o do template.

### Tabela dos `desfecho`

| `desfecho` | Significa | Clamou? | O que fazer |
|---|---|---|---|
| `vazia` | Não havia task pendente para os canais de `CANAIS_FILA`. **É o estado sadio de repouso** | não (`claim: 204`) | nada |
| `ok` | Análise gerada, validada e gravada pelo PATCH | sim | nada — mas confira `fallback` (§8) |
| `ocupado` | O lock estava tomado, ou a GPU tinha slot ocupado, ou era a janela de sync (`motivos: janela_sync`) | **não** | nada; o próximo tique tenta |
| `chat` | Havia conversa recente no llama — o worker cede a GPU ao humano | **não** | nada |
| `llama_fora` | A 8080 recusou conexão ou deu 500 | **não** | ver se o `llama-server` está de pé |
| `config` | `fila_intel.env` ausente/ilegível, `CANAIS_FILA` vazia ou desconhecida, chave ausente/duplicada/fora do formato | **não** | §5 e §6. **Falha permanente — pinta o check** |
| `chave` | O site recusou a chave (401/403) | não fechou | §5, passo 2. **Falha permanente — pinta o check** |
| `reprovada` | Guarda determinística do validador: limite de texto, escopo 2a violado, ou `recent_window.days ≠ 90`. Repetir daria o mesmo payload | sim, e mandou `fail` **sem** `retry` | ler `motivos`; é bug de código ou de dado, não transitório |
| `llama` | As duas tentativas depois do claim falharam por infra (`truncado`, `timeout`, `json`, `pensou`) | sim, `fail` **com** `retry` | a task volta para a fila; se repetir, olhe a GPU |
| `orcamento` | A tentativa 1 falhou por infra e restavam menos de 9 min — não houve tentativa 2 | sim, `fail` **com** `retry` | a task volta para a fila |
| `falha_site` | O snapshot falhou (`etapa: snapshot`) | depende | site fora, ou rota mudou |
| `conflito` | O PATCH levou 409: outra coisa já fechou a task | sim | normalmente benigno |
| `fail_perdido` | O `fail` que deveria devolver a task à fila não chegou | sim | a task fica `running` até o watchdog (30 min) |
| `indeterminado` | O PATCH não teve resposta conclusiva | sim | o watchdog resolve |
| `bug` | Exceção não prevista. Depois do claim: `fail` sem `retry`, `motivos: [<Tipo da exceção>]`. **Antes** do claim: `claim: null` e **sem** `fail` | depende | ler `motivos` e o `.err` |
| `morto` | `SystemExit` ou sinal — na prática, a máquina desligou ou reiniciou | talvez | a task clamada fica `running` até o watchdog |

**`etapa`** diz onde parou: `inicio`, `config`, `slots`, `chat`, `claim`, `snapshot`, `features`,
`escolher`, `redigir`, `validar`, `patch`, `sombra`.

**`claim: null` com `desfecho: bug`** = quebrou antes de existir task; nada ficou pendurado no site.

### Quando o jsonl está mudo

A linha só é escrita no fim. Se o worker morre antes de pegar o lock — venv sem `httpx`,
`AGENTE_SITIO` errado — **nada** vai para o jsonl e tudo vai para o `.err`:

```
ssh forja 'wc -c /opt/agente/log/fila_intel.err'
```
```
ssh forja 'tail -40 /opt/agente/log/fila_intel.err'
```

`.err` com 0 bytes é o estado normal. `.err` crescendo a 144 tracebacks por dia é o crashloop: quase
sempre é o `AGENTE_SITIO` (§1) ou o venv. O arquivo é truncado no lugar acima de 1 MB, mantendo as
últimas 2.000 linhas e **o mesmo inode** — o cron o mantém aberto pelo `>>`.

---

## 8. `URL_FILA` vermelho

O bloco do pulso roda de hora em hora, calcula **um** motivo e pinga `$URL_FILA` (sucesso) ou
`$URL_FILA/fail`. Ele **nunca toca em `$ok`** — o check principal segue independente. O motivo
também entra em `/opt/agente/log/pulso.log`.

Primeiro passo, sempre:

```
ssh forja 'tail -3 /opt/agente/log/pulso.log'
```
```
ssh forja 'tail -5 /opt/agente/log/fila_intel.jsonl'
```

**Precedência dos motivos — só o primeiro sai:** `leitura` → `jsonl` → `parada` → `task` →
`sem-claim-24h`.

| Motivo | Significa | O que pede |
|---|---|---|
| `fila-leitura-<Tipo>` | O `python3 -` embutido no pulso levantou exceção lendo o jsonl | jsonl corrompido, permissão, disco. Olhe o arquivo à mão |
| `fila-jsonl-ausente` | `/opt/agente/log/fila_intel.jsonl` não existe | o worker nunca rodou, ou alguém apagou. Rode uma execução manual (§4, passo 4) |
| `fila-jsonl-<N>s` | O jsonl tem mais de **70 min** (4200 s) de idade | **cron morto ou import quebrado.** Confira `crontab -l \| grep -c fila_intel` e o `.err` (§7). O limiar já cobre 25 min de execução + tiques que pegaram o lock ocupado |
| `fila-parada:chave` | A última linha `cron` teve `desfecho: chave` | §5. Falha permanente: a chave foi revogada ou o seed não fechou. **Uma linha `cron` nova com `claim` 200/204 limpa sozinha** |
| `fila-parada:config` | A última linha `cron` teve `desfecho: config` | §6. `fila_intel.env` sumiu, ficou ilegível, ou `CANAIS_FILA` está vazia/errada |
| `fila-task-<desfecho>` | A última linha `cron` **que clamou uma task** tem menos de 24 h e não terminou em `ok` | ler o `desfecho` na tabela da §7. Uma linha `ok` mais nova apaga o motivo na hora |
| `fila-sem-claim-24h:nenhuma` | Nenhuma linha `modo: cron` nas últimas 24 h | o cron não está rodando, ou só houve execução manual/sombra |
| `fila-sem-claim-24h:<desfecho>` | Houve linhas `cron` em 24 h, mas **nenhuma** com `claim` em (200, 204) | o desfecho no sufixo diz por quê: `chat` (GPU sempre ocupada por humano), `morto`, `llama_fora`. Em `ocupado`, o sufixo traz o primeiro `motivos` |
| `fila-mudo` | O bloco produziu saída vazia | fecha fechado, de propósito. Trate como `fila-leitura-*` |

**Alarme falso a evitar:** um modo auxiliar (`--sombra`, `--escolher`, `--canario`) grava no mesmo
jsonl e mexe no mtime — ele **adia em até 70 min** o vermelho de "cron morto". **Não rode modo
auxiliar enquanto investiga um cron parado.** As regras de `parada`, `task` e `sem-claim-24h` só
olham `modo: cron`, mas a regra do mtime olha o arquivo.

**Vermelho durante um desligamento planejado não é incidente** — a §3, passo 3, manda pausar o check.

---

## 9. "O texto saiu pobre"

O sintoma: a análise no Health Coach é genérica, sem número, sem nome de série. O check está
**verde** e o `desfecho` é **`ok`**. Isso é o modo de falha mais importante deste sistema: *ausência
de dado virando afirmação confiante, com o fallback em verde*. Quem detectou na primeira vez foi o
dono, olhando a tela — nenhum portão pegou.

Diagnóstico, nesta ordem:

**1. O `series.json` existe?** É a causa maior e a mais fácil de confundir com "o modelo é ruim".

```
ssh forja 'ls -l /opt/agente/series.json 2>/dev/null || echo AUSENTE'
```

Ausente → `series: []` → o núcleo analítico da fase 2a roda sobre nada, e o texto correto é
"Nenhuma série se afasta da coorte do mesmo período." A receita está na §2.

Presente, mas nenhum `id` casa com o snapshot → a linha do jsonl traz `motivos: series_orfas`
(vídeo apagado e recriado, ou edição à mão). Mesmo sintoma, causa diferente.

**2. Caiu no `fallback`?** O campo está em toda linha do jsonl.

```
ssh forja "tail -20 /opt/agente/log/fila_intel.jsonl | python3 -c \"import sys,json;[print(d['quando'],d['desfecho'],d['fallback'],d['motivos']) for d in map(json.loads,sys.stdin) if d.get('modo') in ('cron','manual')]\""
```

`fallback: ["summary"]` = **o texto do Gemma foi reprovado nas duas tentativas e o que foi publicado
é o template**. O template é o **piso de segurança, não a entrega**. Isso é bug, tem conserto, e
**não pinta o check** — o pulso só olha `desfecho`, `claim` e `task`.

**3. Ler os `motivos`.** Eles dizem por que o validador reprovou:

| `motivos` | Significa |
|---|---|
| `rotulo_cru` | O modelo escreveu um nome de campo (`views_90d`, `dias_sem_publicar`…). **Causa conhecida:** o próprio system prompt tem 19 ocorrências de 8 nomes de campo, e o validador recusa qualquer token `snake_case`. O prompt ensina o vocabulário que proíbe — 4 de 4 reprovações em 22/09 |
| `zod` | Estourou limite de texto: `pattern_id` > 80, `finding` > 300, `analysis_text` > 2000 |
| `longo` | `AVISO_ESTREITO + summary` passou de 500 unidades UTF-16 |
| `curto`/`emoji` | Aparo cortou demais, ou o modelo usou emoji |
| `janela_<n>` | `recent_window.days ≠ 90` — bug de dado, não de texto |
| `series_orfas` | ver o item 1 |

**4. Ler a sombra crua.** É a única forma de ver o prompt, a resposta literal do Gemma e o veredito
do validador. **Sem claim, sem PATCH, sem chave** — é seguro rodar em produção:

```
cd /opt/agente
```
```
AGENTE_SITIO=/opt/agente/docs/sitio.py venv/bin/python -B docs/trilha/fila_intel.py --sombra --snapshot docs/trilha/fixture_pt.json
```
```
ls -t /opt/agente/sombra/ | head -3
```

**Passe sempre o `--snapshot`** enquanto o worker da forja estiver atrás do commit `3dde429` (§2):
sem a flag ele estoura `TypeError` e a linha sai `desfecho: bug`.

O arquivo da sombra traz `system`, `user`, o payload montado, o veredito e os tempos. Leia-o antes
de mexer em limiar nenhum.

**5. Só então considere o escopo.** A fase 2a é **deliberadamente estreita**: views e séries, nada
mais. A aba "Visão geral" da mesma tela mostra CTR, Retenção, Alcance e Impacto em Subs — o site
**tem** esses números e a forja os ignora de propósito, porque cada número novo é uma chance a mais
de o modelo inventar. Abrir o escopo é decisão do dono, e vem **depois** de consertar o prompt:
mesmo preso a views + séries, um parágrafo de verdade já bate o template.

---

## 10. Onde está o resto

- **Kit da forja:** `~/Workspace/forja/ferramentas/` — repositório git **local, sem remoto**.
  O `README.md` de lá diz o que é cada arquivo e como se instala.
- **Ledger da execução real:** `.superpowers/sdd/2026-09-19-forja-fila-inteligencia-plan/progress.md`.
  É onde estão as Rulings (R1–R28), os bugs achados ao vivo e as três coisas que foram ditas ao dono
  e estavam erradas.
- **Deriva conhecida entre spec/plano e a forja:** as notas `> **Deriva (22/09)**` inseridas no spec
  e no plano marcam cada comando que **não** é executável como escrito.
