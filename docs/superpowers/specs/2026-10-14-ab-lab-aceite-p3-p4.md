# Emenda 48 (proposta do Gio): critérios de aceite finais de P3, P4a e P4b

14/10/2026. Revisão de texto, sem navegador e sem produção. Fontes lidas: emendas 29 a 47 (foco 41, 44, 47, 32, 46), seção 3 inteira, seção 5, parecer 03 da Hanna (seção 5), mockup aprovado (`docs/superpowers/mockups/2026-10-14-ab-lab-p4-dialogo-e-faixa/index.html`, texto extraído; não abri no navegador). Não rodei teste nenhum nem li código: o que afirmo sobre código vem do spec.

## 0. O que está sólido e o que eu corrijo no texto de hoje

Sólido: a troca do aceite de produção por um ensaio com o dono (41) e a declaração de `falhou`, `pulado_drift` e `precisa_confirmar` como não verificados em produção. Os testes 15 a 25 cobrem as sete linhas de 3.3 e as corridas de 22.

Defeitos de aceite no texto (cada um vira regra abaixo):

| # | Onde | Defeito | Severidade |
|---|---|---|---|
| G1 | 41, passo 1 ("a variante A vai ao ar") | Se A é a original (como no mockup), iniciar não muda nada visível: o passo passa com ou sem escrita. Falso verde | corrige |
| G2 | 41, passo 3 ("dentro do prazo medido em (iii)") | (iii) mediu 0 h em um vídeo, uma vez; "prazo" sem número não reprova nada | corrige |
| G3 | 41, passo 2 ("no dia seguinte, a variante B está no ar") | `ab-rotate` verde em `/api/health` não prova rotação. A prova é o ciclo 1 gravado, não a saúde do cron | corrige |
| G4 | 41, passo 5 ("lê o mesmo estado") | "Mesmo" sem regra de comparação. Falta definir: igualdade do JSON cru, na lista e no `GET`, REST e MCP | corrige |
| G5 | 41, passo 6 e 46 ("não aparecem aplicar vencedor/cancelar carência") | Ausência em tela, sem lista de telas, só se prova com varredura de código mais captura das três telas | menor |
| G6 | 44 (P3), 422 pelo Cowork | Afirma só o erro, não que nada foi criado, nem que `description_text: null` continua aceito | corrige |
| G7 | 12 (P3) | O teste "nunca envia descrição diferente da lida" não cobre descrição ausente/vazia nem os campos que o YouTube apaga se faltarem no `snippet` | corrige |
| G8 | 41 | O ensaio não exercita a releitura do original (32 m, B1), que é a mudança de comportamento mais perigosa da P4a (título mudado à mão entre criar e iniciar) | corrige (passo de 2 min no mesmo ensaio) |
| G9 | 47 | O limite de 5 min só tem teste de leitor com relógio injetado; falta o caso de fuso (o dono usa de fora do país) e o caso em que a função ainda está viva | corrige |

## 1. Regras de leitura valem para tudo abaixo

- **Cada critério tem: o que se faz, o que se vê, o que reprova.** Reprova = a entrega não vai a produção (ou o ensaio não conta) até consertar.
- **Quem roda o quê.** Consulta SQL de produção e ação no YouTube: o dono, com consulta preparada pelo agente (o agente não lê produção). Local com semente: eu ou o controlador, no `bythiago_int` para integração e no Supabase local padrão para tela, pelo runbook `docs/ops/runbook-cms-e2e-local.md` (credenciais falsas de e-mail; o servidor local tem YouTube e Blob reais carregados: nenhum passo local clica em sincronizar, enviar arquivo nem encerrar teste com vídeo real; o `youtube-client` é mock em todo teste de escrita).
- **"Verde" de cron não é evidência.** Com zero teste ativo, `ab-rotate`, `ab-watchdog` e `ab-evaluate` saem `ok` sem tocar em nada. Todo critério de produção cita a linha de banco que prova, não o health.
- **Horários sempre de São Paulo.** O dono estará fora do país e no Opera: a tela mostra SP; a consulta devolve UTC (08:00 UTC = 05:00 SP).

## 2. P3: sai a descrição

### 2.1 Local, com semente

Semente (datas relativas): um rascunho combo, um rascunho thumbnail, um rascunho title, um teste `active` combo com ciclo aberto cujo `applied_metadata` ainda tem `description_set` e `links_resolved` (dado de antes da P3), e uma variante antiga com `description_text` não nulo (para provar que a leitura de dado velho não quebra).

| # | O que se faz | O que se vê | O que reprova |
|---|---|---|---|
| P3-L1 | Abrir "Novo teste", 1440 e 390, tema escuro e claro | Três tipos: Thumbnail, Título, Título + thumbnail. Nenhum campo de descrição, nenhum acordeão, nenhum selo "recomendado". O combo traz a frase "mede o conjunto; não separa título de thumbnail". Zero erro de console, zero aviso de hidratação | Qualquer um dos três itens ausente; quarto tipo; texto "Descrição" em qualquer parte do wizard; erro de console |
| P3-L2 | `POST` de variante pelo pipeline com `description_text: "x"`, com `description: "x"`, com `description_text: ""` | 422 com "A descrição não participa mais do teste A/B" nos três casos. Contagem de linhas em `ab_test_variants` igual antes e depois | 201/200; erro 500; mensagem em inglês ou diferente; linha criada |
| P3-L3 | O mesmo `POST` com `description_text: null` e sem o campo | Aceito, variante criada sem descrição (G6) | 422 (quebra cliente que manda `null`) |
| P3-L4 | Mesmo `POST` por REST e pela ferramenta MCP | Mesmo status, mesma mensagem, byte a byte do `error` | Divergência entre os dois caminhos (paridade Cowork × Claude Code) |
| P3-L5 | Abrir o teste `active` com `applied_metadata` antigo, o histórico do ciclo e a tela do vídeo | Abre sem erro; as chaves `description_set` e `links_resolved` são ignoradas sem aparecer como "undefined", nulo nem 0 | Tela quebrada; texto "undefined"; leitor da E18 recebendo chave removida |
| P3-L6 | Aplicar variante (`applyVariantToYouTube`) com o cliente do YouTube em mock que registra o corpo do `videos.update`, para os três tipos | `snippet.description` do corpo é **byte a byte igual** à lida, incluindo: descrição com emoji, quebra de linha `\r\n`, `<` e `>`, 5000 caracteres; **descrição ausente/vazia na leitura**; `tags`, `categoryId`, `defaultLanguage`, `defaultAudioLanguage` reenviados iguais (G7). O título trocado é o único campo diferente | Qualquer byte diferente; campo omitido (o YouTube apaga o que falta no `snippet`); descrição "" onde a leitura não tinha |
| P3-L7 | Título da variante com 101 caracteres, com `<`, com só espaços | A escrita é recusada **antes** de ir ao YouTube, ou o erro do YouTube (`invalidTitle`) vira `YouTubeApiError { status, reason }` e a rotação trata como falha, não como sucesso | Sucesso falso; exceção sem `reason` |
| P3-L8 | Migration A no `bythiago_int`: (a) sem teste de descrição; (b) com um teste `description` semeado; (c) rodar duas vezes | (a) `pg_get_constraintdef` de `ab_tests_test_type_check` mostra exatamente `thumbnail`, `title`, `combo`; `insert` com `description` falha com código 23514; (b) aborta com "Migration A abortada: testes de descrição:" **listando o id e o status**, e a constraint antiga continua intacta; (c) sem erro. Reversão (par `drop`/`add` com quatro valores) devolve o estado e é testada | (b) aplicar mesmo assim; (b) constraint removida sem a nova criada; mensagem sem id |
| P3-L9 | `grep -rniE "description_text|test_type.*description|'description'" apps/web/src` fora de `database.types.ts` e da camada de leitura declarada | Só o que a lista de arquivos da seção 2 (corrigida pela emenda 44) permite | Referência esquecida em tela, Zod ou registry |

Specs que devem existir: unidade para P3-L6 e P3-L7 (nível mais barato, é regra pura sobre o corpo da requisição; Yannis); integração para P3-L8 (`describe.skipIf(skipIfNoLocalDb())`, `apps/web/test/integration/`); rota para P3-L2 a P3-L4 (nível de rota, sem navegador); **um** spec Playwright para P3-L1 (papel e nome acessível: `getByRole('radio', { name })`, nunca classe), 1440 e 390, rodado três vezes seguidas. Não há spec de ponta a ponta para o resto: não depende de navegador.

### 2.2 Produção (o dono; consultas do agente)

1. **Antes da Migration A.** Consulta: `select test_type, status, count(*) from ab_tests group by 1,2`. Esperado: **zero** linha `description`. Se houver, a Migration A **não** roda e o caso volta a mim. Reprova: aplicar a A sem esta consulta no ledger.
2. **Depois do deploy do código, antes da A (janela real).** O dono abre "Novo teste": três tipos, sem descrição. Reprova: aparecer o campo.
3. **Depois da A.** Consulta `select pg_get_constraintdef(oid) from pg_constraint where conname = 'ab_tests_test_type_check'`: **exatamente três valores**. Reprova: quatro valores, ou erro de consulta (constraint com outro nome).
4. **Cowork e Claude Code.** O dono cola o texto pronto nos dois e vê o 422 com "A descrição não participa mais do teste A/B" **nos dois**. Depois a consulta de contagem de variantes do rascunho de conferência: igual antes e depois. Reprova: mensagem diferente entre os dois, ou variante criada.
5. **O rascunho de conferência** (combo) abre como "Título + thumbnail" e é **arquivado no mesmo dia**. Consulta: `status = 'archived'`, `started_at is null`, zero ciclo.
6. **Dia seguinte.** `ab-rotate` sem falha em `/api/health`. **Declarado falso verde:** com zero teste ativo isto não prova nada. A prova de que a rotação não mexe na descrição é herdada do ensaio da P4a (item E7 abaixo).

**Não verificado em produção (P3):** a rotação não mexe na descrição (só no ensaio da P4a); o Opera (wizard no navegador do dono é o único conferido por ele; o resto é Chromium); comportamento com descrição de 5000 caracteres de verdade (só mock).

## 3. Migration 0 e migration da P4a (portão, não entrega)

| # | O que se faz | O que se vê | O que reprova |
|---|---|---|---|
| M0-1 | Consulta preparada (a de conferência, "4, 5, 1, true, 0, 0") | Colunas e tabela existem; `restore_seq = 0` e `restore_status` nulo nos testes existentes; guarda devolve 0 | Qualquer número diferente |
| M0-2 | **Primeira tarefa da P4a e de novo antes de promover a `main`**: a mesma guarda de D3 | 0 linhas | Teste com carência aberta ou `auto_resolve` pendente: a P4a **não promove** |
| M0-3 | Conferir em produção quem executa `rotate_cycle` hoje (`has_function_privilege`, nunca chamando; chamar `anon` derruba o Postgres local) | Resultado registrado no ledger **antes** de o dono iniciar teste | Resultado ausente |
| M0-4 | Migration da P4a no `bythiago_int` | `anon` e `authenticated` recebem `permission denied` em `ab_rotate_commit`; `restore_seq` trocado devolve nulo e não abre ciclo; `rotate_cycle` não existe mais | `anon` executa; ciclo aberto num teste `completed` |
| M0-5 | A migration da P4a em produção **antes** do código da P4a que chama `ab_rotate_commit` | Consulta mostra a função | Código no ar sem a função: `ab-rotate` passa a falhar todo dia às 05:00, em silêncio se o `catch` for largo |

## 4. P4a: sair do ar com segurança e ver o que ficou

### 4.1 Local, com semente (portão de código)

Semente: um vídeo de teste com `original_title`, cópia da original no Blob (mock), e os testes abaixo, cada um com dado próprio (nunca herdado): T-ativo-combo (ciclo 0 aberto, B no ar), T-ativo-thumb, T-ativo-title, T-pausado, T-completo-ok, T-completo-falhou (title `falhou`, thumbnail `ok`), T-pulado-drift, T-pulado-sem-base, T-pulado-sem-original, T-em-andamento-4min, T-em-andamento-6min, T-em-andamento-16min, T-restore-status-nulo (mundo antigo), T-restore-status-vazio (`{}`). O `youtube-client` e o Blob são mocks que registram cada chamada de escrita e podem ser programados para recusar (403, 401, 429 `quotaExceeded`, 5xx, timeout).

**Nível integração (banco local, sem navegador): testes 15 a 25 do spec valem, mais estes que faltam**

| # | Cenário | Esperado | Reprova |
|---|---|---|---|
| P4a-I1 | Dois `endAbTest` simultâneos sobre o mesmo teste (`Promise.all`) | Uma execução e um `ja_encerrado`; **uma** escrita no YouTube; um ciclo fechado com `end_reason`; `restore_seq` aumentou exatamente 1 | Duas escritas; dois `end_reason` diferentes |
| P4a-I2 | `pauseAbTest` com o `youtube-client` lançando 403 | Estado **mudou** para `paused` (comportamento novo, 3.2); `restore_status` do campo `falhou` com `erro` só de `status`/`reason`; aviso criado; ciclo fechado com `ended_at = paused_at` | Estado ainda `active`; `erro` com corpo, URL ou token (sai para o Cowork, D9) |
| P4a-I3 | Mock que lança sem `catch` depois do passo 1 | `restore_status.<campo>.estado = 'em_andamento'`, `forcado`, `em`, `attempts` do anterior | `restore_status` nulo; estado intermediário sem rastro |
| P4a-I4 | Vigia com T-em-andamento-14min, -16min | 14 min: **não tocado**. 16 min: `falhou`, `erro = 'interrompido'`, `attempts = 1`, `escreveu = null`; aviso de falha disparado | Tocar aos 14; `escreveu = false` no lugar de nulo (a E18 leria "não reenviou") |
| P4a-I5 | `lerCampoDeRestauracao(campo, agora)` com relógio injetado: 4 min, 5 min exatos, 6 min, 16 min; mais `em` no futuro (relógio do servidor adiantado) | 4 min "em andamento"; 5 min: **fronteira declarada em teste** (a emenda diz "mais de 5 min": 5:00 exato ainda é "em andamento"); 6 min "Sem resposta desde [hora]"; 16 min idem (a leitura não muda o estado gravado); `em` no futuro: "em andamento", nunca negativo nem "Invalid Date" | Fronteira sem teste; `NaN` na tela |
| P4a-I6 | Retomar (i) com escrita ok, (ii) com escrita falhando, (iii) com a função morta depois do envio | (i) `status = 'active'`, `restore_status = '{}'` (**não nulo**); (ii) `paused` e `restore_status` igual ao de antes; (iii) `em_andamento` | `restore_status = null` em qualquer caminho depois da P4a |
| P4a-I7 | Rotação do cron e pausa cruzadas (32 h): pausa entre a escrita da rotação e o fecho | Nenhum ciclo aberto; `Sentry.captureMessage` chamado; aviso "a rotação e uma pausa se cruzaram"; risco residual (a escrita em voo pode terminar depois da restauração) declarado em "não verificado" | Ciclo aberto num teste `paused` |
| P4a-I8 | Marcador velho: `last_applied_variant_id` não nulo deixado por queda (R2-7) | Rotação reivindica por `restore_seq` e segue; não fica parada para sempre | Teste com marcador velho nunca mais rotaciona (falha em verde) |
| P4a-I9 | Vigia com T1 `completed` (`falhou`, `forcado: true`) e T2 `active` no mesmo vídeo; depois iniciar T2 com T1 em `falhou` | O vigia não escreve; iniciar T2 deixa T1 com `desistiu/novo_teste` | Vigia regrava por cima do T2 |
| P4a-I10 | `startAbTestInternal` com o leitor do YouTube devolvendo O no 1º e B no 2º, dois inícios do mesmo rascunho | `original_title = O`, uma escrita no YouTube, um ciclo 0 | Duas escritas |
| P4a-I11 | Iniciar com variante B de thumbnail sem `blob_url` | `ok: false`, "a variante X não tem imagem", **nada** escrito no YouTube nem no banco (nem `status = 'active'`) | Teste ativo com variante sem imagem |
| P4a-I12 | Os sete casos do CHECK `ab_tests_restore_status_shape` (C1), mais `restore_status` com `erro` de 10 000 caracteres | Os sete falham com o nome da constraint; o `erro` longo é truncado antes do CHECK ou o CHECK define o teto | Gatilho engolindo erro; escritor que recebe erro opaco |
| P4a-I13 | O passo 4 **não** incrementa `restore_seq`; regravar o mesmo `seq` em `ab_test_restores` substitui | Uma linha por (teste, seq, campo), `gravado_em` muda | Duas linhas; seq pulando |
| P4a-I14 | `anon` e `authenticated` em `ab_test_restores` | Só `select` para `authenticated` e `service_role`, por `has_function_privilege`/`has_table_privilege`, sem chamar | Escrita permitida |
| P4a-I15 | `GET` do teste e a lista, REST e MCP | `restore_status` presente e **igual byte a byte** nos quatro caminhos; `restore_seq` ausente; `erro` sem corpo de resposta; campo derivado `leitura` coerente com I5 | Coluna vazando; divergência REST × MCP |
| P4a-I16 | Prévia de remoção de canal com teste `completed` com `falhou`, `desistiu` e `em_andamento` | Aviso nomeia vídeo, campo e o que ficou no ar; **não bloqueia** | Remoção bloqueada; remoção sem aviso |
| P4a-I17 | Vigia: leitura do drift lança | A poda de `ab_test_polls` roda; `drift.falhas = 1`; `recordCronFailure` chamado; **a resposta não é `ok` mudo** (falha em verde) | Cron verde com drift não verificado |
| P4a-I18 | Vigia com relógio falso (12 s por teste, corte em 45 s, 6 testes) | 4 processados, `adiados: 2`, falha registrada | `adiados` sem falha; passar de 60 s |
| P4a-I19 | `SEM_DESTINATARIO`: `fanOutToSiteAdmins` devolve 0 | Resposta do cron traz `SEM_DESTINATARIO` e `recordCronFailure` | Sucesso com aviso que ninguém recebeu |
| P4a-I20 | Entradas hostis: título original de 100 caracteres, com emoji, aspas e `<script>`; vídeo apagado no YouTube (`videos.list` sem o vídeo); vídeo com `original_title` nulo; thumbnail 4:3 | Linha 7 vira `desistiu/video_inexistente` com o aviso; `<script>` nunca é interpretado na faixa nem no diálogo; nulo vira `pulado_sem_original`, **nunca** "" gravado no YouTube | Título em branco enviado ao YouTube |

**Nível ponta a ponta (Playwright, Chromium, runbook; um spec por fluxo, dado semeado pelo próprio teste, espera por condição, seletor por papel e nome acessível; cada spec falha sem a funcionalidade e passa com ela, e roda três vezes seguidas)**

Tela contra o mockup aprovado, em 1440 e 390 px, nos dois temas, por estado. Aqui o que se afere é o que o mockup prometeu; o que mudar na frase volta ao dono (emenda 31).

| # | O que se faz | O que se vê | O que reprova |
|---|---|---|---|
| P4a-E1 | Abrir "Encerrar teste" em T-ativo-combo | Diálogo "O que fica no vídeo?" com `role=dialog`, nome acessível pelo título, `fieldset` + `legend`; **nenhuma opção marcada**; botão "Encerrar" desabilitado (`aria-disabled`) com "Escolha uma opção."; ordem de Tab: Encerrar, Cancelar; Esc fecha; foco volta ao botão que abriu. A linha "mais views/dia" **não existe** (emenda 40) | Opção pré-marcada; botão ligado sem escolha; linha de views |
| P4a-E2 | Marcar B | Botão passa a se chamar "Encerrar e ficar com B", nomeando o que vai ficar | Botão genérico |
| P4a-E3 | Clicar "Encerrar e ficar com B" **duas vezes rápido** (duplo clique) e depois com o `youtube-client` demorando 50 s | Uma só requisição ao servidor; "Encerrando…" com "Pode levar até 1 minuto"; X e Esc livres; depois de 45 s ou conexão caída: "Sem resposta. Não sabemos se o encerramento foi feito. Recarregue a página", **sem** botão de repetir "Encerrar" | Segunda requisição de escrita; mensagem "Encerrado" sem resposta |
| P4a-E4 | Fechar o diálogo durante "Encerrando…" e recarregar | A faixa lê `em_andamento` do banco e mostra "Voltando ao original…"/"Trocando pela variante B…" com "desde [hora SP]"; nenhum diálogo reaberto | Faixa vazia (perdeu o estado ao recarregar) |
| P4a-E5 | Duas abas: A abre o diálogo de T-ativo; B pausa o mesmo teste; A confirma "Encerrar" | A recebe "Outra tentativa está em andamento. Tente de novo em instantes." ou `ja_encerrado` lido como estado novo; opção B mantida, foco não se move; **nada** é escrito duas vezes | A escrevendo sobre a pausa de B |
| P4a-E6 | Sessão expirada com o diálogo aberto (limpar cookie de sessão, confirmar) | Redirecionamento ao login ou mensagem "Sessão expirada"; **estado do teste intocado** no banco | "Encerrado" na tela sem linha mudada |
| P4a-E7 | T-ativo-combo com título editado por fora, depois só thumbnail, depois os dois (mocks do YouTube) | `alertdialog` "Trocar mesmo assim?"; mostra "No YouTube agora" e a variante B lado a lado; foco em "Voltar", que devolve à escolha com B marcada; só "Trocar ... e encerrar" envia `forcar: true`; título e thumbnail num só diálogo, corpo rola a 390 | Escrita sem passar pela confirmação; dois diálogos em sequência no combo |
| P4a-E8 | Usuário sem permissão de administrar o site | Opções de variante desabilitadas com "Só quem administra o site pode deixar uma variante no ar. Você pode voltar ao original."; miniatura que não carrega mostra "Sem imagem"; sem botão na faixa | Opção de variante clicável; erro 500 em vez de 403 |
| P4a-E9 | Faixa em cada estado semeado: em andamento (A1, A2), sem resposta (A3, com `em` há 6 min), tudo certo (B), falhou só título (C), falhou ao deixar B com e sem `forcado` (D, D2), pulados (E, F, G) | O texto, o ícone e a cor **exatos do mockup** por estado; uma linha por campo quando os estados diferem; cor da borda é a do pior estado; link "Abrir no YouTube Studio" onde o mockup tem; **nenhum botão** (P4a); em `falhou`: "Este aviso ainda não pode ser dispensado." (Logan) e **nenhuma** frase de nova tentativa automática (emenda 40) | Frase de nova tentativa na P4a; botão na P4a; cor só (sem ícone e texto) para o estado; texto "undefined"/"null"/"NaN" |
| P4a-E10 | Estado ausente: T-restore-status-nulo (mundo antigo) e T-restore-status-vazio (`{}`) | Nulo: nenhuma faixa, nenhuma frase inventada de "voltou ao original" (o teste nunca passou pelo código novo). `{}`: tudo certo ou sem faixa, conforme o mockup B | Nulo exibido como "Título e thumbnail voltaram ao original" (falha em verde clássica); nulo exibido como erro |
| P4a-E11 | Mesmos estados com o relógio do navegador em `America/Sao_Paulo` e em `Asia/Tokyo` (`timezoneId` do Playwright) | A mesma hora na faixa nos dois: "12/10 05:02" (São Paulo) | Hora do navegador; virada de dia errada perto da meia-noite de SP |
| P4a-E12 | Título original de 100 caracteres com emoji, quebra exótica e `<script>alert(1)</script>` | Quebra de linha dentro do card (sem rolagem horizontal da página em 390); `<script>` aparece como texto; nenhum diálogo nativo dispara | Estouro do layout; XSS |
| P4a-E13 | Console e rede de cada tela e de cada estado | Zero erro de console, zero aviso de hidratação, zero requisição com 4xx/5xx não esperada | Qualquer um (é achado mesmo com a tela bonita) |
| P4a-E14 | Varredura de texto em Lista, Detalhe e Diálogo do A/B Lab | Nenhum "Aplicar vencedor", "Cancelar carência", "Aplicar variante líder", "Arquivar sem aplicar" (G5) | Qualquer ocorrência |
| P4a-E15 | Acessibilidade mínima: alvo de toque ≥ 44 px no X e nos botões; foco visível; contraste dos textos da faixa nos dois temas (Naksu mede, eu só afiro a presença) | Conforme mockup | Alvo menor; foco invisível |

**Opera.** O mockup usa zero `color-mix()` (conferi por busca no HTML). O componente real precisa manter assim; **teste de guarda**: `grep -rn "color-mix" ` no componente da faixa e do diálogo devolve vazio (regra do Opera). O que depender de renderização do Opera de verdade vai ao dono (seção 4.3).

### 4.2 Ensaio com o dono (aceite de produção da P4a), em dois dias de calendário

**Condições prévias (reprova o ensaio antes de começar):**
- M0-1, M0-2, M0-3 e M0-5 no ledger com resultado; `devolver-hq` rodado em vídeo sem `maxresdefault` e dentro de 6 bits (emenda 30, antes de a P4a ir a `main`).
- O vídeo é escolhido pelo dono; vídeo antigo e de pouca view; ele **não** o edita no Studio durante o ensaio, **exceto** o passo E0.
- **O desenho do teste importa (G1).** A = original. B tem título **diferente** do original e thumbnail **visivelmente** diferente (distância dHash esperada > 6; a medida (iv) do portão serve de piso). Se B se parecer com A, o ensaio é inválido: não prova nada sobre a thumbnail (aceite da regra "variantes parecidas", 3.3).
- O agente prepara: as duas consultas de D10, e um comando de **leitura** (0 unidade de cota: baixa a `hqdefault` pública) que imprime a distância dHash da thumbnail no ar contra a original e contra cada variante. Se o comando não existir, é tarefa do plano da P4a; sem ele o passo E3 vira avaliação a olho e **não conta como verificado**.

**Linha do tempo.** Dia 1: E0, E1. Dia 2 (depois das 05:00 SP; o `ab-rotate` roda às 08:00 UTC, então conferir **a partir das 05:15 SP**): E2 a E7.

| # | Quando | O dono faz | O dono vê (e a consulta que prova) | Reprova |
|---|---|---|---|---|
| E0 | Dia 1, antes de iniciar (G8, 2 min) | Cria o teste combo (rascunho). **Muda o título do vídeo no Studio** para um texto novo, e só então inicia | Consulta: `ab_tests.original_title` é o **título novo**, não o do dia do rascunho; o vídeo continua com o título novo (não foi sobrescrito). Ao fim do ensaio o título que o dono escolher manter é o que ele quiser | `original_title` com o texto velho: ao encerrar, o vídeo voltaria a um título que ele já tinha trocado |
| E1 | Dia 1 | Inicia. A (original) no ar | Studio: título e thumbnail **iguais ao que estavam** (nada muda: A é a original), descrição e idioma do vídeo iguais. Consulta: ciclo 0 aberto, `restore_seq = 1` (a reivindicação do início), `restore_status` nulo ou `{}` | Alguma coisa mudou no vídeo; descrição ou idioma diferentes; dois ciclos 0 |
| E2 | Dia 2, depois das 05:15 SP | Abre o vídeo no YouTube e o A/B Lab | Studio: **título e thumbnail de B**, descrição e idioma inalterados. Consulta: ciclo 0 fechado com `end_reason = 'rotacao'`, **ciclo 1 aberto na variante B**, `last_applied_variant_id` nulo, `restore_seq` aumentou 1. Leitura de dHash: thumbnail no ar a ≤ 6 da B (G3) | Ainda A no ar às 05:15 (investigar `ab-rotate` antes de qualquer outra coisa); ciclo 1 ausente com cron "verde" (falha em verde, **bloqueia**); descrição alterada, ou idioma do vídeo mudou (vem `defaultLanguage` reenviado: P3 e emenda 3.4) |
| E3 | Dia 2 | **Pausa** o teste (B no ar) | Tela: faixa com "Título e thumbnail voltaram ao original em [hora SP]". Studio/leitura de dHash: **título igual ao `original_title` do E0** e thumbnail ≤ 6 da original, **medidos em T+0, T+30 min e T+3 h**; basta uma leitura dentro da tolerância. Consulta D10: ciclo 1 fechado com `end_reason = 'pausa'`; `restore_status.title` e `.thumbnail` em `ok`, `destino = 'original'`; **duas linhas** em `ab_test_restores` com `escreveu = true` | Depois de 3 h a thumbnail ainda a > 6 da original **com `estado = 'ok'`** (falso ok, **bloqueia**, vai ao Yannis); título diferente; `escreveu = false` com o vídeo mostrando B; thumbnail em baixa resolução ("O original foi guardado em baixa resolução" ausente mas imagem pequena) |
| E4 | Dia 2 | **Retoma** | Estado `active`; consulta: `restore_status = '{}'` (**não nulo**), as duas linhas de `ab_test_restores` continuam; uma variante no ar; novo ciclo aberto | `restore_status` nulo; linhas de histórico sumiram; ciclo aberto duplicado |
| E5 | Dia 2 | **Encerra** pelo diálogo novo, escolhendo **a original** | Botão "Encerrar e ficar com A (original)"; faixa "Título e thumbnail voltaram ao original em [hora SP]"; estado "Encerrado sem vencedor"; consulta: `completed_reason = 'manual_archive'`, `winner_variant_id` nulo, `winner_applied_at` nulo, `revert_expires_at` nulo; Studio: original; as mesmas medidas do E3 | Qualquer dado de vencedor gravado; título diferente |
| E6 | Dia 2 | Cola no Cowork um texto pronto que lê o teste; depois o mesmo pelo Claude Code | O JSON de `restore_status` e `leitura` recebidos nos dois, **comparados com o da tela e com o da consulta**, são iguais campo a campo, na leitura do teste e na lista; `restore_seq` não aparece (G4) | Qualquer diferença; Cowork vendo "pausado" sem `restore_status` |
| E7 | Dia 2 | Abre Lista, Detalhe e Diálogo do A/B Lab | Nenhum "aplicar vencedor" nem "cancelar carência" (G5) | Qualquer ocorrência |
| E8 | Dia 2, ao fim | O agente roda a consulta de descrição do vídeo: o dono compara a descrição no Studio com a de antes do ensaio (print de antes tirado no E0) | Idêntica, incluindo quebras de linha, links e idioma | Qualquer diferença (**bloqueia**; é o critério de P3 herdado) |

**Herda o P2-P5** do plano da P2, reescrito pela v7 (o que a P2 desligou continua desligado: nenhum vencedor automático, nenhuma carência). Consulta: zero teste com `grace_expires_at` não nulo e zero `completed_reason = 'auto_resolve'` depois do ensaio.

**Se o ensaio falhar:** o primeiro teste **não** é liberado; o defeito vai com passos numerados e consulta ao Yannis (código) ou Phil (dado); o ensaio recomeça do E0 num vídeo limpo.

**Dado a restaurar no fim:** o dono confere que o vídeo está com o título e a thumbnail que ele quer; o teste do ensaio fica `completed` (não é apagado: o histórico é evidência).

### 4.3 O que a P4a NÃO verifica em produção (declarado)

Nenhum estado abaixo é produzido com um YouTube real, porque forçar o erro exigiria quebrar o vídeo do dono. Valem os testes 15 a 25, P4a-I1 a I20, P4a-E1 a E15 e as capturas locais com semente. No ledger e no relatório de release a linha é literalmente **"não verificado em produção"**:

| Estado | Por quê não dá em produção | Onde está provado |
|---|---|---|
| `falhou` (recusa do YouTube, token, 401, 403, `quotaExceeded`) | Exige o YouTube recusando uma escrita legítima | P4a-I2, I3, P4a-E9 (C, D, D2) |
| `pulado_drift` e `precisa_confirmar` | Exige editar o vídeo do dono à mão no meio do teste | P4a-E7, P4a-E9 (E), testes 20 e 23 |
| `pulado_sem_original`, `pulado_drift` com `sem_base_de_comparacao`, `desistiu/video_inexistente` | Exige apagar a cópia no Blob ou o vídeo | P4a-I20, P4a-E9 (F, G) |
| `em_andamento`, "Sem resposta desde", `interrompido` aos 15 min | Exige matar a função no meio | P4a-I3, I4, I5, P4a-E4 |
| Corrida rotação × pausa (risco residual de 32 h) | Janela de segundos às 05:00 SP | P4a-I7 (o risco que sobra é declarado ao dono) |
| Drift detectado pelo dHash no vigia (10:00 e 20:00 UTC) | Exige troca manual de thumbnail durante o teste; se a detecção desceu para a P4b (corte de reserva da emenda 29), vale o combinado "não trocar à mão" | Teste 23 |
| Aviso no sininho e `SEM_DESTINATARIO` | Exige falha real | P4a-I2, I19 |
| Opera de verdade (render dos cartões, diálogo, foco) | Só o dono tem | **Roteiro** abaixo |
| Rede lenta real, conexão caída no meio | Não simulo rede de outro país | E3 de P4a (45 s) cobre o texto, não a rede real |
| Leitor de tela | Não conferi | Pendente; só estrutura (`role`, `fieldset`) é afirmada |

**Roteiro do dono para o Opera (depois do deploy; 5 min, dentro do ensaio, E5):** (1) abrir o A/B Lab, um teste encerrado e um ativo; (2) abrir "Encerrar teste", ver se as miniaturas, os selos e as bordas aparecem (cartões com fundo e borda visíveis, não transparentes); (3) com o teclado, Tab, Esc e Enter; (4) olhar a faixa de restauração; (5) dizer "fundo ou borda sumiram em tal lugar". Nada transparente é esperado: o mockup não usa `color-mix`.

## 5. P4b: a nova tentativa do vigia e os botões

### 5.1 Local, com semente

| # | Cenário | Esperado | Reprova |
|---|---|---|---|
| P4b-I1 | Vigia, T-completo-falhou com `attempts = 1`, dois ciclos (10:00 e 20:00 UTC simulados) | Uma tentativa por execução; `attempts` 2, depois 3; na terceira `desistiu` e o aviso próprio (`ab-restore-desistiu:<testId>`) com o que ficou no ar | Duas tentativas na mesma execução; `desistiu` na segunda |
| P4b-I2 | `quotaExceeded` | `falhou`, **não conta** para as três | Conta |
| P4b-I3 | `forcado: true` com `em` de 47 h e de 49 h | 47 h: repete forçando; 49 h: usa `forcado: false` e, com valor diferente do atual, `pulado_drift` (Y-11, 48 h) | Repetir o "sim" depois das 48 h |
| P4b-I4 | Deploy da P4b com campo `falhou` anterior ao deploy | Vira `desistiu` com motivo `antes_da_nova_tentativa` | Reentrar na nova tentativa um erro velho |
| P4b-I5 | `retryRestore` e vigia simultâneos | Uma só escrita; o outro `em_andamento` | Duas escritas |
| P4b-I6 | `retryRestore` bem-sucedido no último campo de um teste com destino variante | `winner_applied_at`, `applied_by = 'manual'`, `revert_expires_at` gravados e `autoImportWinner` chamado **uma** vez; chamado de novo, sem efeito (Y-12) | `winner_applied_at` nulo com campo `ok`; importação duplicada |
| P4b-I7 | `dismissRestore(testId, campo)` | Apaga só o campo; o outro permanece; se não sobra campo, `restore_status = '{}'` (nunca nulo, D4) | Nulo; campo errado apagado |
| P4b-I8 | Permissões: destino original exige poder de encerrar; destino variante exige administrar o site | Sem permissão: 403, botões ausentes na faixa (mockup I) | Botão presente e inerte; escrita permitida |
| P4b-I9 | **Resposta do cron** com zero para tentar | Traz o contador da fase nova **mesmo com zero** (`tentadas: 0`, `adiados: 0`); e quantos destinatários o aviso teria; zero destinatário = `SEM_DESTINATARIO` + `recordCronFailure` | Campo ausente quando zero ("rodou e não havia nada" indistinguível de "não rodou") |
| P4b-I10 | Teste novo no mesmo vídeo (Y-5) | A fase ignora o antigo | Escrever por cima de teste `active` |
| P4b-E1 | Faixa com botões nos estados H e I do mockup e nos botões "Tentar agora" e "Já corrigi no YouTube: dispensar aviso" | Textos exatos do mockup; "Tentar agora" em `falhou` e `desistiu`; dispensar em `falhou`, `desistiu` e `pulado_*`; duplo clique em "Tentar agora": uma tentativa; durante a tentativa o botão fica desabilitado e a faixa mostra `em_andamento` | Tentativa dupla; botão ainda ativo; faixa com a frase da P4b na P4a |
| P4b-E2 | Faixa H: "A restauração falhou 3 vezes e parou" e "Não haverá nova tentativa automática" | Só depois do terceiro `falhou`; antes disso, "Nova tentativa automática por volta das 07:00 (SP), tentativa 2 de 3" com a hora **calculada do próximo ciclo (10:00 ou 20:00 UTC) em SP**, não fixa | Hora fixa no texto; "tentativa N de 3" com N errado |

Specs: integração para P4b-I1 a I10 (nível mais barato, regra de servidor); **um** spec Playwright para P4b-E1 e P4b-E2, semeado.

### 5.2 Produção

1. Duas execuções seguidas do vigia (10:00 e 20:00 UTC) **sem falha em `/api/health` e dentro de 60 s** (pelo `cron_health`, `duration_ms`, não pela saúde). Reprova: `duration_ms` ≥ 45 s com `adiados > 0` (a emenda 38 manda registrar falha).
2. A resposta do cron do vigia traz o contador da fase nova **com zero** (por exemplo `tentadas: 0`). Reprova: campo ausente. **Declarado falso verde:** zero tentativa não prova que a nova tentativa funciona.
3. **Não verificado em produção:** os botões, a nova tentativa e `desistiu`: só aparecem se houver falha real. A captura local aprovada no mockup é a prova; o dono aprova a captura.

## 6. Migration B (só o aceite; o dono roda)

Antes: o arquivo do `pg_dump` das três tabelas do A/B existe fora do repositório, tamanho > 0, o dono disse onde; consultas mostram zero teste `active` ou `paused`, zero `parent_test_id` não nulo em `draft`/`queued`/`active`/`paused`, zero linha em `tracked_links` com `source_type = 'ab_test'`; 7 dias da P3 no ar, no ledger. Depois: as colunas e `create_playoff_test` não existem (assinatura de `pg_proc` conferida no dia); o A/B Lab abre; a prévia de remoção de canal responde; `ab-rotate` seguinte sem falha (falso verde declarado se não houver teste ativo); ledger registra que o rollback da Vercel para antes da P3 quebra. Reprova: aplicar sem o `pg_dump` conferido.

## 7. Ordem de prova (resumo para o controlador)

1. P3 local (seção 2.1) e produção (2.2) → Migration A.
2. Migration 0 já aplicada; guarda M0-2 de novo → migration da P4a (M0-4, M0-5) → P4a local (4.1) → `devolver-hq` → promoção.
3. Ensaio (4.2): E0 e E1 no dia 1, E2 a E8 no dia 2. Só depois, o primeiro teste.
4. P4b (5.1, 5.2).
5. Migration B quando houver gatilho.

## 8. O que eu NÃO conferi

- Nada em navegador, produção, banco ou código. A afirmação "o mockup não usa `color-mix`" vem de busca textual no HTML (zero ocorrências), não de renderização.
- Se `devolver-hq` e o comando de leitura do dHash existem: o spec cita `devolver-hq` e eu proponho o comando; se não existir, o passo E3 do ensaio perde a medição objetiva.
- Se "mais de 5 min" é estrito ou inclusivo no 5:00 exato: o spec diz "mais de"; o plano da P4a precisa fixar e testar a fronteira (P4a-I5).
- O padrão de rotação `abba` com duas variantes: não conferi que B entra no primeiro ciclo depois do 0; se não entrar, o E2 deve ser reescrito pela primeira variante não original.
- Leitor de tela, rede lenta real e Opera de verdade ficam com o dono, com o roteiro do item 4.3.
