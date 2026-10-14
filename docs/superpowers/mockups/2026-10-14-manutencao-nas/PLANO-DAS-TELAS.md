# Plano das telas da fase de manutenção (etapa M4): o `18-v2`, a frase de "Remover canal", o 19 e as peças 1 a 8

Escrito em 14/10/2026 pela frontend-design, **para o Logan (UX) aprovar antes de qualquer desenho**. É só plano: o que cada tela mostra, em que ordem, com que estados, frases e cores. Nenhum HTML nasce antes do acordo do Logan e da Naksu.

**Fontes.** Spec `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/04-telas.md` (aprovado pelo dono em 14/10), citado como **04 Lnnn** (número da linha do arquivo); `05-calendario-dono-e-pedidos.md` §15.1 linha M3b (**05 L22**); `03-ciclo-falhas-e-ensaio.md` §13.6 (**03 L43, L50**). O mockup 18 aprovado: `../2026-10-13-a5-lote-2/18-aviso-banco-limite/` (`NOTAS.md`, citado como **18-NOTAS §n**; `RETORNO-DO-DONO-13-10.md`). O diálogo de hoje: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/remove-dialog.tsx` (citado como **diálogo de hoje**). Convenções do lote 2: `../2026-10-13-a5-lote-2/CONVENCOES.md` (**CONV §n**).

**Fora deste plano.** A peça 9 (mudança de casa declarada) foi retirada no fecho de 14/10 (04 L528-530) e não é desenhada. Ficam só as três linhas que valem para todo silêncio da casa (varredura em curso, varredura terminada, relógio da forja: 04 L532-536), dentro da peça 2.

**Ordem deste documento = ordem de prioridade do pedido:**

1. Seção 2: o diálogo "Remover canal" (a frase vai para produção na M3b, antes de 28/11: 05 L22, 04 L271).
2. Seção 3: o `18-v2` (peça 5).
3. Seções 4 a 6: o 19 (a casca), a peça 1, a peça 2 e o resto da peça 3 (a M5 consome).
4. Seções 8 a 10b: as peças 6, 7, 8 e 4 (a peça 5 é o `18-v2`, seção 3).
5. Seção 11: pontos que o Logan precisa decidir. Seção 12: o que vai ao `ROTEIRO-DE-TESTE-E-MELHORIAS.md`.

---

## 1. Base comum a todas as peças (decidida uma vez, vale para todas)

### 1.1 Direção visual: nenhuma identidade nova

O pedido proíbe identidade nova (pedido; CONV §3 "o lote 2 também não cria matiz livre"). Então a decisão de desenho desta fase não é de paleta nem de tipo: é **de forma**. A coisa memorável de toda a fase é **a régua de etapas** ("O caminho de cada mês", 04 L117), a mesma família de forma em toda peça: régua de cinco etapas do mês, linha de duas etapas depois do primeiro passo, régua de quatro etapas do canal removido, régua de quatro etapas dos vídeos antigos. Quem aprende a ler uma lê as outras. Todo o resto fica quieto.

Revisão contra o padrão genérico: a tentação seria cartões iguais por mês com selo verde. Rejeitado: o spec manda o que está bem recuar ("mês saudável é cinza com um verde pequeno; verde nunca ocupa a tela inteira", 04 L127), e a linha que precisa do dono é a única com contorno de cor (04 L127). Os meses são **linhas de uma lista**, não cartões; o cartão só existe por tipo de dado.

- **Tipo:** o que já está em produção e nos mockups (CONV §3): Inter (corpo 14/1,5; apoio 12-13), JetBrains Mono com `tabular-nums` para todo número e data, Fraunces só no título do Observatório. Sem tipo novo.
- **Casca:** `A.moldura` + `L.obs` (CONV §2), tudo o que é novo com contorno tracejado `--forja` e a marca "+ novo"; o selo "ajuste de mockup aprovado: <número>, <data>" em cada tela tocada (04 L440).
- **Alinhamento:** à esquerda em tudo; números à direita só dentro de tabelas.

### 1.2 Cores: tokens existentes, só valores literais

Tabela de tokens: CONV §3 (valores de `chrome.css` e `tokens-telas.css`). Todo token usado abaixo já é hex ou `rgba()` literal; **nenhum `color-mix()`** em borda, fundo, texto ou forma (04 L127, L428; pedido). O degradê da régua do 18-v2 ("de âmbar a vermelho", 04 L349) é `linear-gradient` entre dois hex literais, nunca mistura calculada.

| Significado | Token (escuro / claro) | Forma que anda junto (04 L119-127) |
|---|---|---|
| Feita e válida | `--success` #22c55e / #11692F, **só no símbolo**; a linha fica `--text` em fundo neutro | círculo com visto |
| Falta, ainda vai chegar | `--dim` #958A75 / #6E624E | círculo pontilhado, contorno neutro |
| Falta e devia estar (atrasada) | contorno `--warning` #f59e0b / #B45309 | círculo pontilhado, contorno âmbar (04 L141) |
| Atrasada ou vencendo | `--warning` no símbolo; texto `--warning-text` (#92400E no claro); fundo `--warn-subtle` | triângulo com "!" |
| Parada, ou o arquivo não bate | `--danger` #F26B6B / #B42318 no símbolo e na borda; **texto da linha em `--text`** (04 L127; 18-NOTAS §1.4) | octógono com "!" |
| Não medido | `--nm` / `--nm-line` / `--nm-bg`, hachura 135° | hachura rosa, sempre com o motivo |
| No arquivo | contorno sólido `--dim` sobre `--sunk` | caixa de arquivo (ícone novo, 1.3) |
| Zero medido / sem registro neste mês | borda 2 px `--im-zero` #7A8FA6 / #5B6F86 | caixa vazada com o 0 dentro (04 L138) |
| Em leitura mensal | contorno 2 px `--dim`, metade cheia `--muted` | ◐ (ícone novo, 1.3; 04 L476) |
| Em andamento | `--muted` sobre `--sunk` | barra de progresso cinza (04 L137) |
| Proposta nova no mockup | `--forja` tracejado | "+ novo" (só na mostra) |

**Proibido nesta fase:** `--dir-up`/`--dir-dn` para estado (04 L127); `--forja` para "conferido pela forja" (04 L153); `--border-strong` em forma de estado (04 L555). Âmbar contra vermelho mede 1,38:1 / 1,31:1 (04 L127): **a forma é que separa**, e nenhuma linha traz cor sem forma.

### 1.3 Ícones novos (só dois) e a legenda única

O conjunto `L.IC` não tem caixa de arquivo nem ◐ (04 L545). O relógio (já "exportação a confirmar", "inconclusivo", "ainda não existe") e a pausa ("Parado") **não podem ser reaproveitados** (04 L545). Desenho dos dois novos, a 16 px, traço 1,5 px:

- **Caixa de arquivo:** retângulo baixo com tampa e uma fenda horizontal; sem o 0 dentro (o 0 é do zero medido, 04 L138).
- **◐:** círculo de contorno 2 px com a metade esquerda cheia. Prova obrigatória no 19: lado a lado com o pontilhado e com a caixa de arquivo, a 16 px, em escala de cinza e a 390 px; se não separar, troca o desenho e mantém a regra (04 L544).

**Legenda num só lugar por tela** (04 L413, item 3): uma linha recolhível "Como ler as formas" no topo de cada peça, com as nove formas da tabela 1.2 e as duas origens da conferência do B2, "conferido pela forja" e "conferido por você", **com o mesmo visto e sem cor própria** (04 L153, L554).

### 1.4 As três ausências (todas as peças)

| Ausência | Forma | Frase-modelo | Fonte |
|---|---|---|---|
| Não respondeu (a casa) | triângulo âmbar até 36 h; octógono vermelho a partir de 36 h (**proposta deste plano**, ver 11.6) + data do último sinal | "A casa não respondeu desde dd/mm hh:mm." | 04 L45, L174, L415; 03 L50 |
| Não medido (o site não leu o próprio registro) | hachura rosa + o que não foi lido | "Não foi possível ler <o quê>." | 04 L46 |
| No arquivo | caixa de arquivo + data | "No arquivo desde dd/mm." | 04 L47 |

Regra transversal: **nenhum estado "sem dado" aparece como zero, vazio ou verde** (04 L43; pedido). Toda lista que pode vir vazia tem duas versões desenhadas: zero medido (caixa `--im-zero` com a frase) e não medido (hachura). Exemplo fixo: "Nenhum canal removido pede limpeza." é zero medido; "Não foi possível ler os canais removidos." é hachura (04 L204, L237).

### 1.5 Carregando: servidor ou requisição, declarado por peça (04 L552)

| Peça | Leitura | Carregando |
|---|---|---|
| Diálogo "Remover canal" | requisição ao abrir | "contando…" em cada linha, `aria-busy`, botão de confirmar desabilitado com frase de status (04 L271; diálogo de hoje) |
| 18-v2 (pastilha e painel) | servidor | não há (18-NOTAS §1.15) |
| Peça 1 nas telas de série | servidor, junto da série | não há |
| Peça 2, corpo dos tipos | servidor | não há |
| Bloco "Canais removidos", seção "Vídeos antigos", simulações (peças 3 e 8) | requisição | esqueleto com a altura final da linha (04 L552) |
| Peça 6 (pedido) | requisição + espera longa | estados próprios ("Pedido feito às hh:mm. Aguardando a casa.") |

### 1.6 390 px e acessibilidade (todas)

04 L428-431 e CONV §1.11: 1440 e 390, claro e escuro, alvo de 44 px, sem rolagem horizontal, foco visível, Esc fecha a confirmação e devolve o foco, movimento reduzido, contraste medido (3:1 forma, 4,5:1 texto), escala de cinza com a linha de problema ainda à frente. A 390 px: régua de etapas vira **coluna de ícones com rótulo curto embaixo** (cinco ícones de 24 px cabem em 358 px); a frase vem acima da régua; a linha do canal removido empilha em duas linhas; chips ao lado da pastilha quebram de linha (`flex-wrap`, 04 L548). Nome de canal comprido (40 e 100 caracteres): reticências no rótulo de linha com o nome inteiro em `title` e `aria-label`; **nas frases de alerta quebra, nunca corta** (04 L549).

### 1.7 Vocabulário

O vocabulário fixado (04 L13-31) manda. Palavras que nunca vão à tela fora do ⓘ: "lote", "unidade", "selar", "selado", "selagem", "partição", "cadeia", "atestação", "hash", "ensaio", "restauração", "divergente", "ambiente", "tabela", "linhas", "MB", "toco", "congelado", "congelamento", "estágio", "classe" (04 L35). Dois conflitos com CONV §1.8 estão em 11.1.

### 1.8 Precedência de marcas num vídeo (04 L547)

Proposta da Naksu, adotada como plano: **uma marca só, a pior**: saiu do YouTube > no arquivo > em leitura mensal; as outras viram "Também: fixado" (ou "Também: troca salva").

---

## 2. Prioridade 1: o diálogo "Remover canal" (vai para produção na M3b, antes de 28/11)

**Propósito.** Antes do clique, dizer ao dono quanto se perde e o que acontece com o arquivo do canal, sem escolha: remover sempre apaga também o arquivo (04 L271).

**Onde.** Tela Canais (`2026-10-06-historico-fixar-video/canais.html`, `#confirm`; botão em `lote-1/c.js`) e o componente de hoje. No 19, os quadros levam o selo "ajuste de mockup aprovado: canais.html, <data de APROVACOES-DO-DONO.md>" (04 L461, L526). **O 18 aprovado não tem diálogo de remover** (conferido: `bl.js` não tem "Remover"; a ligação com o 18 é o ⓘ das exportações, "o canal não pode ser removido"), então os quadros "mockup 18" de 04 L270-271 são desenhados sobre a tela Canais, e o 18-v2 não ganha diálogo. Ver 11.4.

**O que entra em produção na M3b e o que não entra.** A M3b leva a frase completa, decidida pela capacidade presente (04 L275). Em 28/11 e antes, nenhum canal tem cópia no arquivo (05 L22: "até lá nenhum canal tem unidade"), e a página do Arquivo ainda não existe; logo, **os estados que o dono verá primeiro em produção são os da combinação "Não | Não"**: D1, D2 e D5. Os estados de mês fora do banco (D4) e de mês fora das telas (D7) só ocorrem depois da M6 e da M10b, mas a frase já tem de existir; o mockup os desenha para o Logan aprovar o conjunto.

### 2.1 Seções, em ordem (de cima para baixo)

1. Título: "Remover <canal>?" (diálogo de hoje; nome longo quebra, não corta).
2. Abertura: "Remover apaga todo o histórico deste canal:" (diálogo de hoje).
3. **Lista de perdas** (a do diálogo de hoje, número em destaque, rótulo, apoio): as quatro linhas atuais (versões guardadas, dias de registros, vídeos fixados, trocas salvas) **e uma quinta, nova: "No arquivo"**, com a caixa de arquivo como ícone; **não é parágrafo novo** (04 L271, "Forma"). As contagens que têm parte no arquivo dizem as duas parcelas e somam: "812 dias de registros" com o apoio "420 no banco, 392 no arquivo" (04 L494; o desenho da parcela é proposta, ver 11.5).
4. Frase "Também saem as leituras da forja…" (diálogo de hoje, sem mudança).
5. **"O que acontece:"** (frase por capacidade, tabela 2.3).
6. **Parágrafo em destaque** só nos casos de D4 (mês fora do banco ou vídeos retirados) + o campo do nome do canal.
7. **"Não dá para desfazer:"** (a de hoje é trocada pela de 04 L271 quando há arquivo; sem arquivo continua a de hoje).
8. Frase de status `role="status"` (leitor de tela).
9. Botões: "Cancelar" (foco inicial) e o de confirmar, o mais pesado (04 L254, L271).

### 2.2 Estados

| # | Estado | O que a tela diz (frase exata) | Botão de confirmar | Cor e forma | Fonte |
|---|---|---|---|---|---|
| D0 | Contando | Cada linha: "contando…". Status: "Contando o que será apagado. Remover canal fica disponível quando a contagem chegar." | desabilitado (`aria-disabled`, descrito pelo status) | linhas em `--dim`, `aria-busy` | 04 L271 ("Enquanto lê"); diálogo de hoje |
| D1 | Sem arquivo e sem imagem no Blob (i) | Linha "No arquivo": caixa de zero medido "0" + "meses no arquivo". Abaixo da lista: "Este canal não tem cópia no arquivo. Ao remover, não sobra nada a limpar." | "Remover canal" | zero medido (`--im-zero`); nada de verde | 04 L271 (i) |
| D2 | Sem arquivo e com N imagens no Blob (ii) | "Este canal não tem cópia no arquivo, mas tem N imagens guardadas no Blob (ⓘ). Ao remover, elas ficam anotadas para apagar." + a segunda frase da tabela 2.4. N = 1: "tem 1 imagem guardada no Blob" e "ela fica anotada para apagar". ⓘ: "Blob é o armazenamento de imagens do site, na Vercel." | "Remover canal" | caixa de zero medido na linha "No arquivo"; a frase do Blob em `--text`, círculo pontilhado neutro (ainda vai ser apagado) | 04 L271 (ii), L283-289 |
| D2c | Contando as imagens | "contando…" na linha das imagens | desabilitado | como D0 | 04 L271 ("Enquanto conta") |
| D3 | Com arquivo | Linha "No arquivo": "N meses no arquivo" em destaque, apoio "de mm/aaaa a mm/aaaa (N registros), no NAS e no B2". **"O que acontece:"** frase da tabela 2.3. **"Não dá para desfazer:"** "depois disso não existe cópia dos registros deste canal em lugar nenhum." O tamanho ("X MB") só no ⓘ da linha. ⓘ do "O que acontece": "Antes, o arquivo de um canal removido ficava no NAS e no B2 para sempre. Agora vai junto, para o dado não sobrar anos depois. Depois dos arquivos, os snapshots do NAS ainda guardam o canal por um prazo (a página mostra a data)." | **"Remover e apagar do arquivo"** | caixa de arquivo `--dim`; botão `.btn danger` de hoje | 04 L271 |
| D4a | Com arquivo e meses que já saíram do banco | Parágrafo em destaque, acima do botão: "N desses meses (de mm/aaaa a mm/aaaa) já saíram do banco e só existem no arquivo. Eles se perdem de vez. Para continuar, digite o nome do canal." + campo | "Remover e apagar do arquivo", desabilitado até o nome bater (maiúscula ou minúscula; colar não é bloqueado) | o estilo `fx-never` do diálogo aprovado com a caixa de arquivo; **sem cor nova** | 04 L271, L257 |
| D4b | Só vídeos retirados | "N vídeos deste canal (publicados de mm/aaaa a mm/aaaa) já foram retirados do banco e só existem no arquivo. Eles se perdem de vez. Para continuar, digite o nome do canal." Sem contagem: "Há vídeos deste canal que já foram retirados do banco e só existem no arquivo." | idem | idem | 04 L271 |
| D4c | Os dois | "N meses (de mm/aaaa a mm/aaaa) e N vídeos (publicados de mm/aaaa a mm/aaaa) já saíram do banco e só existem no arquivo. Eles se perdem de vez. Para continuar, digite o nome do canal." | idem | idem | 04 L271 |
| D5 | Leitura do arquivo falhou | A linha "No arquivo" em hachura rosa: "Não foi possível ler o arquivo deste canal. Nada foi removido." + botão "Tentar de novo". **Nunca "0 meses", nunca "nada a limpar".** Leitura das imagens falhou: a mesma linha, nunca "0 imagens" | **não é oferecido** (divergência declarada do aprovado: 04 L271, L441) | hachura `--nm` | 04 L271 |
| D6 | Com a casa fora | Acrescenta: "A limpeza do arquivo espera a casa, que não responde desde dd/mm. A remoção vale do mesmo jeito." | o de D3 | triângulo âmbar com a data (1.4) | 04 L271 |
| D7 | Mês fora das telas (M6 em diante) | No lugar do botão: "<Outubro de 2026> saiu das telas e o espaço dele ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo." + antes da data: "O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta." / depois: "Você já pode liberar o espaço ou trazer o mês de volta." + "(abrir o Arquivo)" **só para quem administra**. Quem só edita: "… Quem só edita o site: peça a quem o administra." e, depois da data, "O espaço já pode ser liberado, e o mês também pode voltar, por quem administra o site." Plural: "Outubro e novembro de 2026 saíram das telas e o espaço deles ainda não foi liberado" (a data é a mais distante). ⓘ: "Enquanto o mês pode voltar ao banco, remover o canal deixaria, na volta, registros dele sem canal a que pertencer." "Exportar" continua permitido | não há (substituído pela frase) | **círculo pontilhado com contorno neutro e o nome do mês** (espera com saída dita, não erro) | 04 L270 |
| D7r | Recusado no clique (o mês saiu das telas entre abrir e clicar) | A mesma frase de D7, com "**nada foi removido**". O código `mes_destacado_em_transito` nunca chega à tela | não há | como D7 | 04 L270 |
| D8 | Contagem do banco falhou (as quatro linhas de hoje), arquivo lido | Fica como o aprovado: "Não foi possível contar o que será apagado. A remoção continua disponível e apaga tudo o que está descrito acima." | disponível | como hoje | diálogo de hoje; ver 11.3 |

### 2.3 A frase de "O que acontece" e a de depois do clique, por capacidade presente (04 L275-281)

A tela decide pelo que existe (comando de limpeza em produção? bloco "Canais removidos" em produção?), **nunca por data** (04 L275). `<chega em dd/mm | ainda não tem data para chegar>`: a tela escreve uma das duas.

| Comando / Bloco | "O que acontece:" (diálogo) | Depois do clique, com arquivo |
|---|---|---|
| Sim / Sim | "o site remove o canal agora e marca o arquivo para apagar. Os arquivos só somem do NAS e do B2 depois de um comando seu, no Mac, em até 30 dias; a página do Arquivo mostra cada passo e o dia em que acabou." | "Canal removido em dd/mm. Falta apagar o arquivo dele: N meses. Próximo passo: rodar o comando no Mac (ver os comandos), até dd/mm (30 dias). Ponha um lembrete no celular: a página só avisa quando você a abre." ("ver os comandos" só para quem administra) |
| Não / Sim | "… Os arquivos só somem do NAS e do B2 depois de um comando seu, no Mac. Esse comando ainda não existe e <chega em dd/mm \| ainda não tem data para chegar>. Até lá o arquivo continua no NAS e no B2. A página do Arquivo vai mostrar cada passo e o dia em que acabou." | "Canal removido em dd/mm. Falta apagar o arquivo dele: N meses. O comando para isso <chega em dd/mm \| ainda não tem data para chegar>; até lá não há nada a fazer." |
| Não / Não (**o de produção em 28/11**) | igual à linha anterior | igual à linha anterior |

### 2.4 Canal sem arquivo, com imagens no Blob (04 L283-289)

| Comando / Bloco | Diálogo (depois de "ficam anotadas para apagar.") | Depois do clique (depois de "N imagens do canal ainda estão no Blob.") |
|---|---|---|
| Sim / Sim | "O site tenta apagá-las todo dia, e a página do Arquivo mostra quantas faltam." | a mesma |
| Não / Sim | "O comando que as apaga <chega em dd/mm \| ainda não tem data para chegar>; até lá elas continuam no Blob, e a página do Arquivo mostra quantas faltam." | "O comando que as apaga <…>; até lá não há nada a fazer." |
| Não / Não | "O comando que as apaga <…>; até lá elas continuam no Blob. A página do Arquivo vai mostrar quantas faltam." | "O comando que as apaga <…>; até lá não há nada a fazer." |

**Depois do clique, sem arquivo**, decidido pela contagem lida **depois** da remoção (04 L271): zero, "Canal removido em dd/mm. Não havia arquivo: nada a limpar."; N, "Canal removido em dd/mm. Não havia arquivo, mas N imagens do canal ainda estão no Blob." + a frase da tabela 2.4 (N = 1: "1 imagem do canal ainda está no Blob"). Se antes eram N e depois é zero: a frase (i) (04 L291).

**Onde aparece o "depois do clique":** na tela Canais, na faixa de retorno que o fluxo de remoção já usa (verificar no `canais.html` aprovado qual é: aviso no topo da lista). Cor: neutra, com a caixa de arquivo quando há arquivo; nunca verde de "sucesso" sobre uma limpeza que ainda não aconteceu.

### 2.5 O que o dono testa no Opera (diálogo)

1. Abrir "Remover" num canal e ver as cinco linhas em "contando…"; o botão não reage ao clique e não muda de lugar quando a contagem chega.
2. D1 e D2 (o caso real de 28/11): a linha "No arquivo" mostra a caixa de zero, não um traço nem um vazio; ler a frase do Blob e abrir o ⓘ.
3. D3 nas três combinações: a frase "O que acontece" muda conforme o comando existe; nenhuma promete data que não existe.
4. D4: o botão fica desabilitado até digitar o nome; colar funciona; maiúscula não importa; nome de 100 caracteres.
5. D5: o botão de confirmar some; "Tentar de novo" funciona; nada diz "0".
6. D7 como administrador e como editor (sem o link "abrir o Arquivo"), antes e depois da data, com dois meses.
7. Tab, Shift+Tab e Esc: o foco começa em "Cancelar" e volta ao botão "Remover" ao fechar. 390 px no tema claro: botões de 44 px, nada corta.

---

## 3. Prioridade 1: o `18-v2` (peça 5)

**Propósito.** Responder "o banco vai ficar sem espaço antes do alívio chegar?" com o percentual de hoje e se o alívio chega antes do aperto (04 L57).

**Onde.** Arquivo novo `18-v2.html` (+ `bl2.js`/`bl2.css`) **dentro da pasta do 18**, sem editar nenhum arquivo aprovado dela (04 L440). O 18 aprovado continua abrindo igual. Selo: "ajuste de mockup aprovado: 18, 13/10/2026".

### 3.1 O que fica igual ao 18 aprovado

Tudo o que 04 L336-358 não muda: pastilha na faixa de frescor; painel aberto nos alertas e fechado nos calmos; barra de 0% a 100% com os cortes de 70% e 85%; percentual inteiro; MB só no ⓘ; "Quem ocupa" em percentual; exportações; "sem leitura hoje" e "não medido" como estão (18-NOTAS §1-2, §4).

### 3.2 Seções do painel, em ordem

1. **Frase-resumo** (agora com a previsão nova).
2. **Barra do limite** com **dois marcadores**: o preenchimento de hoje e um segundo marcador vazado "chega a 78% antes da próxima saída" (04 L342).
3. Números ("Ainda livre", "Cresceu em 28 dias"), como no 18.
4. **Régua do tempo** ("Quando chega ao limite", de hoje a 1 ano, zona de 90 dias) com **dois marcos**: losango "o banco chega a 85%" e traço "o próximo mês fica pronto para sair" (04 L349).
5. "Quem ocupa o banco do site" (com a parte das séries por mês, 04 L350).
6. Exportações (como no 18).
7. **A linha da cópia** (no lugar do "Backup no NAS … ainda não existe"), e com 70% ou mais o que pode sair agora (04 L347).
8. Com 85% ou mais: **"O que libera espaço"**, lista em ordem (04 L351).
9. ⓘ reescrito (04 L343).

**Fora do painel, na faixa de frescor, ao lado da pastilha e nunca dentro:** o chip do automático (04 L310, L355) e a marca dos canais removidos (04 L354).

### 3.3 A regra de cor nova (divergência 1, volta ao dono)

A cor da pastilha e da frase segue **o mais alto que o banco chega antes da próxima saída**, não o tamanho de hoje (04 L342). O preenchimento da barra continua na cor do tamanho de hoje (como no 18, 18-NOTAS §1.5); o segundo marcador leva a cor do que manda na pastilha. A tabela de coerência da seção 7 das NOTAS do 18 é refeita no `NOTAS-18-v2.md` (04 L342), por estado, lida do DOM.

### 3.4 Estados e frases

| # | Estado | O que a tela diz | Cor e forma | Fonte |
|---|---|---|---|---|
| V1 | Com folga, nada perto | Pastilha "Banco do site: 43% do limite". Linha da cópia: "Todo mês fechado é copiado para o NAS e para o B2. Última cópia: dd/mm" | verde só no círculo com visto; linha da cópia em cinza com o visto | 04 L347; 18-NOTAS §2 |
| V2 | Hoje abaixo de 70%, chega acima antes da próxima saída | Frase: "Antes de novembro sair o banco chega a 78% do limite." (a palavra "pico" não vai à tela). Segundo marcador na barra: "chega a 78% antes da próxima saída" | pastilha âmbar (triângulo) mesmo com a barra de hoje em 66% | 04 L342, L348 |
| V3 | 70% ou mais, com meses prontos | Acrescenta à linha da cópia: "2 meses prontos para sair: liberam cerca de N% do banco", com a porta "Ver o que pode sair" para a página do Arquivo | âmbar | 04 L347, L113 |
| V4 | O alívio chega depois do aperto | Na régua, o losango (85%) vem antes do traço (próximo mês pronto); o espaço entre os dois é pintado de âmbar a vermelho, com a frase "o alívio chega depois do aperto" | degradê entre dois hex literais; o losango em `--danger` | 04 L349 |
| V5 | 85% ou mais | "O que libera espaço", em ordem: meses prontos para sair; as alavancas de reserva (cada uma com quanto libera e o que alguma tela perde; 01 §8.4); quantos canais teriam de sair. **Nenhuma linha fala em plano pago** | vermelho (octógono) na pastilha | 04 L351 |
| V6 | Depois de uma saída | "Novembro saiu em 01/06: o banco foi de 71% para 64%". O percentual que cai **não vira verde** se o banco ainda chega a mais de 70% antes da próxima saída | a cor da regra 3.3 | 04 L352 |
| V7 | Depois de vídeos antigos irem ao arquivo | "Em dd/mm, N registros de M vídeos antigos foram para o arquivo. O percentual não cai com isto: o banco passa a crescer mais devagar." | cinza, caixa de arquivo | 04 L353 |
| V8 | A casa não responde | "A casa não responde desde dd/mm: nenhum mês pode sair até ela voltar. No ritmo de hoje o banco chega a 85% em mm/aaaa. **O que fazer:** peça a quem está em casa para religar a forja e o NAS (se não houver ninguém, a data acima é a sua folga: nada mais a fazer agora); até lá, não acrescente canais. Se chegar a 85% antes disso, pause a coleta de canais (ver o comando)." | forma de "não respondeu" com a data (1.4); a pastilha segue a regra 3.3 | 04 L356; 03 L43 |
| V8a | V8 sem a E10 em produção | A última frase vira "A pausa da coleta ainda não existe" | idem | 04 L356 |
| V8b | Forja responde, NAS fora | Primeira frase: "O NAS não está acessível desde dd/mm", com a ação da linha "NAS fora" da peça 2 | idem | 04 L356, L175 |
| V8c | NAS cheio | Primeira frase: "O NAS está cheio", com a ação da linha "NAS cheio" | idem | 04 L356, L176 |
| V9 | Sem leitura hoje | Como no 18: data e valor da última medida; cor nunca verde | hachura tracejada | 04 L357; 18-NOTAS §1.8 |
| V10 | Não medido | Como no 18. Novo: se não dá para ler o tamanho das séries por mês, a pastilha diz "não medido", **não o número parcial** | hachura rosa | 04 L358 |
| V11 | Chip do automático | "Automático desligou em dd/mm", ao lado da pastilha, com o triângulo âmbar e borda neutra, até o dono abrir a peça 4 | ícone âmbar, borda `rgba` neutra literal | 04 L310, L355 |
| V12 | Marca dos canais removidos (só com o comando de limpeza em produção) | "N canais removidos pedem um comando seu", ao lado da pastilha | caixa de arquivo cinza até 30 dias; + triângulo âmbar aos 30; + octógono vermelho aos 60 (só com a casa respondendo); borda neutra `rgba` literal, texto `--text` | 04 L221, L354 |
| V12n | Sem o comando em produção | A marca **não é renderizada** | n/a | 04 L293, L354 |

**"Quem ocupa"** (04 L350): a parte das séries divididas por mês entra somada certo, inclusive o mês que saiu das telas e ainda não teve o espaço liberado. Proposta: uma sub-linha recuada sob "Concorrentes", só quando há mês nesse intervalo, "<Outubro>, fora das telas, espaço ainda não liberado: N%", com o círculo pontilhado neutro (o espaço ainda vai voltar). Percentuais pelo maior resto, como no 18. Ver 11.7.

**ⓘ reescrito** (04 L343): sai "Backup no NAS (ainda não existe; será ao chegar a um percentual…)". Entra: "Todo mês fechado é copiado para o NAS e para o B2, sempre, sem esperar percentual. O percentual só avisa e mostra o que pode sair." E a previsão: "Até a próxima saída, o banco cresce no ritmo dos últimos 28 dias; o mês que sai devolve a parte dele."

### 3.5 Casos da barra "Estados do mockup" do 18-v2

Os 15 do 18 (para provar que não mudaram) + V2, V3, V4, V5, V6, V7, V8, V8a, V8b, V8c, V10 novo, V11, V12 (30 e 60 dias), V12n. Painel aberto em todos os novos.

### 3.6 O que o dono testa no Opera (18-v2)

1. V1 contra o 18 aprovado lado a lado: nada mudou além da linha da cópia.
2. V2: a pastilha fica âmbar com a barra de hoje abaixo de 70%; a frase diz por quê sem a palavra "pico".
3. V4: ver de longe, sem ler, que o losango vem antes do traço; a faixa âmbar-vermelho aparece no Opera (sem `color-mix`).
4. V5: a lista não fala em plano pago e cada linha diz quanto libera.
5. V6: depois da saída, o número cai e a cor não fica verde.
6. V8 e variantes: a frase diz o que fazer e desde quando.
7. V11 e V12: os chips quebram de linha a 390 px e não entram na pastilha.

---

## 4. Prioridade 2: o mockup 19 (a casca)

**Propósito.** Mostrar cada tela aprovada que a fase toca, antes e depois, no caso cheio simulado em 2028 e no caso de hoje, e os quadros de todas as peças (04 L440, L465).

**Pasta:** `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-o-que-muda-quando-um-mes-sai/`.

**Páginas, nesta ordem:**

1. `index.html`: o topo diz que todo número de mês arquivado é exemplo (04 L408); **a tabela de sincronia** (tela, mockup aprovado e data, o que muda, onde está o desenho, aprovação do Logan, aprovação do dono, commit; 04 L441), com as linhas de 04 L449-465 e as três do diálogo de remover (Canais, 18, divergência declarada: 04 L441); a legenda única (1.3); o **índice de estados** (estado da seção 14.x → quadro; coluna "carregando: servidor/requisição", 04 L432, L552).
2. `series.html`: peça 1 (seção 5).
3. `arquivo.html`: peças 2, 3, 4 e a seção "Vídeos antigos" da 8 (seções 6, 7, 10.2 e 10b).
4. `pedido.html`: peça 6 (seção 8).
5. `fila.html`: peça 7 (seção 9).
6. `canal-video.html`: os quadros da peça 8 nas telas de canal e vídeo (seção 10).
7. `remover.html`: o diálogo (seção 2).

Barra "Estados do mockup" com dois eixos fixos em toda página: **caso** (hoje: nada saiu / cheio 2028: 3 tipos, 7 meses online, 36 no arquivo, 45 canais / magro) e **perfil** (administra / edita / só lê) (04 L417-418), mais o tema.

---

## 5. Prioridade 2: peça 1, "desde dd/mm" e "no arquivo" nas telas de série

**Propósito.** Responder "este número está completo ou falta um pedaço que saiu do banco?" com o "desde dd/mm" junto do número e o trecho no arquivo com forma própria no eixo (04 L53).

**Quem vê:** todo mundo; quem só lê vê "No arquivo desde mm/aaaa." no lugar da porta "Ver antigo" (04 L39).

### 5.1 Formas no eixo (04 L77, L546)

Três ausências no mesmo eixo, nunca confundidas: hachura rosa (não medido); pontilhado (sem contagem: depois de sair do YouTube, depois da leitura mensal, **e antes do início da coleta**); trecho "no arquivo" com **preenchimento `--sunk`, contorno sólido `--dim` e o rótulo "no arquivo desde mm/aaaa" repetido na borda esquerda** (a 390 px sólido e pontilhado se confundem). Junto do rótulo, o botão "Ver antigo" com "Ver o que está no arquivo" abaixo (04 L105).

### 5.2 Estados

| # | Estado | O que a tela diz | Forma | Fonte |
|---|---|---|---|---|
| P1.0 | Nada saiu ainda | Nada muda | n/a | 04 L73 |
| P1.1 | Série começa antes do online | Toda medida calculada sobre a série: número + "desde dd/mm" | texto `--muted` junto do número | 04 L74 |
| P1.2 | Medida precisa de ponto que saiu (views aos 14 dias) | "no arquivo" com a data; **nunca número interpolado**; 1, 7 e 30 dias continuam (vêm das marcas) | caixa de arquivo na célula | 04 L69, L75 |
| P1.3 | Mês destacado, espaço não liberado | "no arquivo desde dd/mm"; ⓘ de quem administra: "ainda dá para trazer de volta enquanto o espaço não for liberado" (sem data limite) | caixa de arquivo | 04 L76 |
| P1.4 | Gráfico alcança o arquivo | Eixo marca onde o online começa; trecho anterior "no arquivo desde mm/aaaa" + "Ver antigo" | 5.1 | 04 L77 |
| P1.5 | 72 primeiras horas no arquivo | "As 72 primeiras horas deste vídeo estão no arquivo desde dd/mm." Curva não desenhada; o resumo diz "não dá para calcular sem as horas" | caixa de arquivo; nunca hachura, nunca curva vazia | 04 L78 |
| P1.6 | Normal do canal com menos vídeos | "Calculado com N vídeos; M estão no arquivo." Abaixo de 3: "não medido: desde dd/mm só há N vídeos com as 72 horas online" | texto; no segundo, hachura | 04 L79 |
| P1.7 | Período maior que o online (21: 6 e 12 meses) | "Mostrando desde dd/mm (3 meses online). Os meses anteriores estão no arquivo" + porta da peça 6; a linha "só há 3 meses de leitura" diz qual motivo vale (coleta recente ou arquivo) | caixa de arquivo | 04 L80 |
| P1.8 | Comentário em destaque sem texto (20) | "Comentário de mm/aaaa. O texto está no arquivo e não aparece aqui." Cartão com contagem e data, nunca vazio | caixa de arquivo | 04 L81 |
| P1.9 | Mês no arquivo que estava vazio | "Sem registro neste mês (conferimos em dd/mm)" | caixa de zero medido | 04 L82 |
| P1.10 | Antes do começo da coleta | "Antes do início da coleta (03/10/2026)"; nunca "no arquivo" | pontilhado | 04 L83, L546 |
| P1.11 | Não medido | "Não foi possível ler desde quando há dado online." Sem assumir 365 dias | hachura | 04 L84 |
| P1.12 | Só leitura | "No arquivo desde mm/aaaa." sem "Ver antigo" | caixa | 04 L39, L418 |

### 5.3 Quadros por mockup aprovado (antes e depois, com selo)

| Mockup | Quadros | Fonte |
|---|---|---|
| 13 histórico do vídeo | P1.2 (2, 3, 5, 14, 21, 60, 90 dias), P1.4, P1.5, cabeçalho com a marca e "Ver antigo" (com a peça 8) | 04 L451 |
| 15 página do canal | P1.4 nas 72 horas, linha do tempo de 90 dias e barras de 180 dias; P1.6 | 04 L452 |
| 20 comentários de destaque | P1.8 | 04 L454 |
| 21 ritmo por hora (segurado) | P1.7 nos seletores de 6 e 12 meses | 04 L455 |
| 14, 17a, 17c | **a confirmar:** quadro só se o caso cheio de 2028 mostrar efeito da janela de 180 dias (1 dia de folga) | 04 L86, L103 |

### 5.4 O que o dono testa no Opera (peça 1)

1. No 13 "depois": as idades 1, 7 e 30 com número; as outras com a caixa de arquivo; nenhuma com número inventado.
2. No eixo, de longe e em escala de cinza (filtro do macOS: Ajustes > Acessibilidade > Tela > Filtros de cor), distinguir as três ausências.
3. "Ver antigo" leva ao pedido (peça 6).
4. Perfil só leitura: sem "Ver antigo", com a frase.

---

## 6. Prioridade 2: peça 2, a página do Arquivo

**Propósito.** Responder "algum mês precisa de mim agora, e quando o próximo pode sair?", com a linha que precisa do dono acima de todo mês saudável (04 L54).

**Onde e como se chega.** Página própria "Arquivo" no Observatório; chega-se pela pastilha do banco ("Ver o que pode sair"), pelo chip "automático desligou" e pelo "Ver antigo" (04 L113). **Quem vê:** quem edita; botões só para quem administra (04 L40-41). Carregamento: servidor, menos o bloco "Canais removidos", a seção "Vídeos antigos" e as simulações (1.5).

### 6.1 Seções, em ordem

1. **Frase-resumo da página** (proposta, ver 11.8): "Arquivo: 1 mês precisa de você (Views por dia, outubro: conferir o B2). Próxima saída possível: 01/05/2027." Sem nada: "Nenhum mês precisa de você. Próxima saída possível: dd/mm/aaaa."
2. Legenda "Como ler as formas" (1.3), recolhida.
3. **Linhas da casa, quando houver** (varredura em curso, terminada, relógio da forja; 04 L532-536). A altura fica reservada entre "em curso" e "terminada" (04 L535).
4. **Bloco "Canais removidos" aqui, se alguma linha pedir comando seu** (04 L202).
5. **Um cartão por tipo de dado**, na ordem de 04 L33: "Leitura de hora em hora", "Views por dia", "Comentários e dados antigos do YouTube". Dentro de cada cartão:
   1. frase-resumo com o próximo marco e a próxima ação ("Views por dia: 7 meses online, 0 no arquivo. Outubro pode sair em 01/05/2027 (faltam 200 dias). Hoje já falta: conferir o B2.", 04 L115);
   2. o interruptor do automático (peça 4), à direita no topo do cartão; no de comentários, "comentários saem sempre por clique" (04 L299);
   3. **a linha que precisa do dono**, no topo, a única com contorno de cor (04 L127, L134);
   4. "O caminho de cada mês": os meses online, do mais antigo (o próximo a sair) para o corrente, cada um com a régua de cinco etapas e o botão da peça 3 quando houver;
   5. meses no arquivo agrupados por ano, numa linha que abre ("2027: 12 meses no arquivo, todos conferidos", 04 L143).
6. **Grupo "Dado de teste"**, só para quem administra, enquanto houver mês de teste aberto (04 L194-200).
7. **Seção "Vídeos antigos"** (peça 8; seção 10.2 deste plano).
8. **Bloco "Canais removidos" aqui, se nenhuma linha pedir comando** (04 L202).

### 6.2 A régua de cinco etapas (04 L117)

Etapas, com rótulo curto embaixo de cada ícone: "No NAS" (copiado e verificado), "No B2" (conferido), "Recuperação" (testada), "Prazo" (fora do prazo de espera), "Pode sair". A frase da linha fica acima da régua e diz a etapa que manda. Depois do primeiro passo a régua vira **duas etapas, "Saiu das telas" e "Espaço liberado"** (04 L133). Espaço liberado: a linha vira a caixa de arquivo (04 L136). Copiando: barra de progresso no lugar da etapa 1 (04 L137).

### 6.3 Estados do mês (04 L145-167), com frase e forma

| # | Estado | Frase | Forma |
|---|---|---|---|
| M1 | No ar | "Em coleta" | régua toda pontilhada neutra |
| M2 | Aguardando a margem | "Fechado. Cópia a partir de dd/mm" (ⓘ: por que se espera) | pontilhado neutro |
| M3 | Copiando | "Copiando: 12 de 45 canais" | barra cinza |
| M4 | No NAS | "No NAS, verificado hoje às hh:mm" | visto na 1 |
| M5 | No B2 | "No B2, conferido pela forja hoje às hh:mm" ou "No B2, conferido por você em dd/mm" (a mais recente) | visto na 2, sem cor de origem |
| M5a | Só a sua conferência vale | "No B2, conferido por você em dd/mm (vale até dd/mm). A forja não confere desde dd/mm." | **triângulo âmbar** na 2 (04 L153) |
| M6 | Recuperação testada | "Recuperação testada em dd/mm" | visto na 3 |
| M7 | Pode sair | "Pode sair" (acende a peça 3) | vistos até a 5 |
| M7a | Pode sair, automático ligado, menos de 3 saídas | "Pode sair, em dois passos, pelo botão. O automático não tira este: faltam N das 3 primeiras saídas" | vistos; nota cinza |
| M8 | Destacado | "Saiu das telas em dd/mm. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. A partir de dd/mm você pode liberar o espaço. Até lá não dá para remover canal nem apagar vídeo" | duas etapas: visto + pontilhado |
| M8a | Pronto para liberar | "Pronto para liberar o espaço. Ainda dá para trazer de volta" | idem |
| M8b | Destacado há mais de 14 dias | "Saiu das telas há N dias e o espaço ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo. Libere o espaço ou traga o mês de volta" | triângulo âmbar na 2ª etapa; sobe ao topo |
| M9 | Precisa voltar | "A cópia de <mês> precisa ser refeita (<motivo>), e para isso o mês tem de voltar ao banco. Traga de volta." Ação única: "Trazer de volta" | triângulo âmbar, contorno âmbar; octógono aos 14 dias; topo |
| M10 | De volta, será copiado de novo | "Outubro voltou ao banco online em dd/mm. O mês será copiado de novo" (ou "O dado dele não bateu com a cópia: o mês será copiado de novo") | pontilhado neutro na etapa de cópia |
| M11 | No arquivo | "No arquivo desde dd/mm. Liberou N% do banco. Verificado em dd/mm" | caixa de arquivo |
| M11a | Sem verificação recente | "No arquivo. Sem verificação há N dias" (+ "a casa não respondeu desde dd/mm") | caixa + triângulo (21 dias); + octógono (45) |
| M11b | Cópia em risco | NAS: "O arquivo de <mês> no NAS está ausente ou diferente. Este mês já saiu do banco: a cópia que resta é a do B2. Confira o B2 agora e recupere dele (ver os comandos): a versão boa fica guardada lá por N dias". B2: "A cópia de <mês> no B2 falhou na conferência de dd/mm. A cópia que resta é a do NAS. Rode a conferência de novo (ver o comando)" | caixa + octógono; topo |
| M12 | Cópia de canal removido em risco | 04 L165, com as três variantes da frase do meio (mês online / destacado / descartado) e a de depois da decisão em cinza | octógono; depois, marca cinza |
| M13 | Canal removido antes da cópia | 04 L166, com "N registros", nunca zero | triângulo; depois, cinza |
| M14 | Vazio conferido | "Sem registro neste mês (conferimos em dd/mm)" | caixa de zero medido (não círculo) |

**Estados de problema** (04 L169-192), um quadro cada, no lugar da etapa que falhou: atrasado ("Cópia atrasada há N dias": âmbar acima de 5, vermelho acima de 30); a casa não respondeu; NAS fora; NAS cheio; verificação vencida; B2 sem conferência (âmbar 6 dias, ou 2 no mês que sai em 7; vermelho sem conferência válida); nada novo no B2 (2 e 5 dias); forja e Mac discordam (as duas frases); mês no arquivo sem conferência do B2 (45/90); nunca conferidos de fora da casa (cinza, pontilhado); conferência tentada e falhou (as três formas de 04 L183, incluindo "aguardando a cópia para o B2"); arquivo não bate; voltou a não selado; proteção desligada; teste de recuperação vencido, inválido, vencendo (30 dias); falta teste de uma série; meses à frente acabando (âmbar abaixo de 6, vermelho abaixo de 3); arquivo desligado; não medido. **As frases são as de 04 L173-192, sem mudança.**

### 6.4 Grupo "Dado de teste" (04 L194-200)

Faixa: "Dado de teste. Isto é um mês fictício, criado para você testar o caminho inteiro sem tocar no dado real. Nada que sair daqui libera espaço de verdade." Cada linha com a marca "teste" (chip neutro, borda pontilhada `--dim`; nunca `--forja`, que é "+ novo"). Espera de 1 dia no lugar de 7. Botão "Encerrar o dado de teste", só depois da recuperação testada e do descarte; depois: "Dado de teste encerrado em dd/mm", uma vez.

### 6.5 Bloco "Canais removidos" (04 L202-245)

- **Frase-resumo:** com o comando, "Canais removidos: N pedem um comando seu (o mais antigo, há N dias); M só esperam o prazo dos snapshots do NAS."; sem o comando, "Canais removidos: N esperam o comando de limpeza, que <chega em dd/mm | ainda não tem data para chegar>."; zero, "Nenhum canal removido pede limpeza." na caixa de zero medido; erro, hachura "Não foi possível ler os canais removidos."
- **Linha por canal:** nome (reticências, nome inteiro no `title`), a régua de quatro etapas ("Limpeza pedida", "Apagado do NAS", "Apagado do B2", "Fora dos snapshots"), a frase, a ação. A 390 px, duas linhas.
- **A 4ª etapa nunca vira visto** (pontilhado neutro com a data, "data calculada, não conferida").
- Estados, cores e frases: as duas tabelas de 04 L206-237, sem mudança, cada linha um quadro (com os 30 e 60 dias da limpeza pedida, a M5 só de leitura, "Sua parte terminou", reapareceu, guardado, sem aviso de remoção, Blob).
- **"Já limpos (N)"**, recolhido no fim: "N canais removidos já não deixam nada a limpar; o último em dd/mm." Zero: "Já limpos (0)".
- "Ver os comandos" (só quem administra): os cinco passos numerados de 04 L241 (aqui o número é legítimo: é sequência).
- "Apagar do arquivo": confirmação com a frase do Blob desconhecido quando couber (04 L243). O texto da confirmação é deste mockup (ver 11.2).

### 6.6 O que o dono testa no Opera (peça 2)

1. Caso cheio: sem ler, apontar qual mês precisa dele (o único com contorno de cor, no topo).
2. Escala de cinza: a linha de problema continua à frente (04 L430).
3. Abrir "2027: 12 meses no arquivo" e fechar.
4. Ler a régua de um mês saudável e de um com "conferido por você (vale até…)".
5. Canais removidos: zero, só leitura (sem comando), 30 dias e 60 dias; "Já limpos" abre.
6. Dado de teste: só aparece como administrador; encerrar e ver a frase.
7. 390 px: régua em coluna de ícones, sem rolagem lateral.

---

## 7. Prioridade 2: peça 3, tirar o mês (o que não é o diálogo de remover)

**Propósito.** Responder "posso tirar este mês? se não, o que falta? se sim, o que eu perco?" (04 L55). Mora na linha do mês, na página do Arquivo.

### 7.1 Estados (04 L249-273)

| # | Estado | O que diz e faz | Forma |
|---|---|---|---|
| T1 | Desabilitado | Lista de condições que faltam, uma por linha, símbolo + ação: "Falta conferir o B2 (última conferência há 41 dias)"; "Cópia sem verificação há 30 horas: a casa não respondeu. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco"; "Ainda dentro dos 6 meses: pode sair em 01/05/2027"; "A forja não confere o B2 há 9 dias". **Nunca botão cinza sem motivo** | um símbolo por linha (triângulo, pontilhado neutro…) |
| T2 | Simulação | Botão secundário "Ver o que sairia", sempre disponível. "Se você tirasse outubro de 2026 agora: 45 canais, 1.234.567 registros, 38% do que este tipo de dado ocupa. Contado agora: tudo bate" + as linhas do canal removido; marca "simulação, nada foi tirado"; contador "simulações vistas: 2 de 2" | marca neutra pontilhada |
| T3 | Habilitado | "Tirar outubro de 2026 do banco online" | botão primário |
| T4 | Confirmação (séries e horária) | A frase de 04 L254 inteira ("Contado agora, no banco: … Para ver de novo: peça o período em 'Ver antigo' (números por mês).") | diálogo; foco em "Cancelar" |
| T4a | Dois passos | acrescenta a frase de 04 L255 | idem |
| T4b | Quarta saída em diante | "Não volta ao banco por este botão. Daqui em diante a saída é em um passo só e não há 'trazer de volta'"; em "Views por dia", qual parte ainda volta | idem |
| T4c | Comentários | a frase de 04 L257, com o campo "apagar comentários de outubro de 2026" | idem |
| T5 | Durante | "Conferindo o banco contra o arquivo", depois "Tirando" | barra indeterminada cinza |
| T6 | Recusado | as quatro frases do catálogo (04 L259) | triângulo ou octógono, conforme a frase |
| T7 | Primeiro passo feito | frase de 04 L260; "Trazer de volta" e "Liberar o espaço (disponível em dd/mm)" desabilitado | duas etapas |
| T7a | Depois dos 7 dias | "Pronto para liberar o espaço. Ainda dá para trazer de volta." Dois botões; aos 14 dias, âmbar | idem |
| T8 | Segundo passo (confirmação) | diz que depois não volta pelo site, quanto libera, que continua no NAS e no B2, e a prova contada de novo | diálogo |
| T8r / T8x | Segundo passo recusado / repetido | "A cópia não pôde ser confirmada agora (<motivo>). O espaço não foi liberado e o mês continua podendo voltar" / "O espaço deste mês já foi liberado em dd/mm." (não vermelho) | neutro |
| T9 | Feito | "Saiu em dd/mm às hh:mm. Liberou N% do banco" | caixa de arquivo |
| T10 | Trazer de volta (+ variantes) | "Outubro voltou ao banco online em dd/mm"; com o dado não batendo; com a proteção não instalada; e a única falha, vermelha: "Não foi possível trazer de volta: o banco encontrou registros sem vídeo…" | neutro; a falha com octógono |
| T11 | Banco em somente leitura | "O banco passou do limite e está em modo somente leitura. Siga o passo de emergência" | octógono |

### 7.2 O que o dono testa no Opera (peça 3)

1. T1: cada condição tem símbolo e diz o que fazer; nenhum botão cinza mudo.
2. T2: a simulação não tira nada e diz isso.
3. T4: Esc fecha e o foco volta ao botão que abriu; T4c aceita a frase colada e em maiúsculas.
4. T7 e T7a: o botão "Liberar o espaço" diz a data enquanto está desabilitado.

---

## 8. Peça 6: o pedido de período longo ("Ver antigo")

**Propósito.** "Consigo ver o passado de um canal, e vai demorar?", com a cobertura por mês à vista (04 L58).

**Seções:** o que será lido + aviso de que não é na hora; botão "Pedir"; barra "Lendo: 9 de 24 meses"; resultado por mês com a cobertura de cada mês ("29 de 31 dias medidos") e "gerado em dd/mm às hh:mm; vale até dd/mm".

**Estados:** as 15 linhas de 04 L364-382, frase por frase. Formas: meses que vieram com visto; mês "parcial" (online e não copiado) com a marca "parcial" em pontilhado neutro; mês que falta por motivo conhecido (casa, NAS, arquivo não bate) leva a forma do motivo (triângulo/octógono), e só "não foi possível ler o estado do pedido" é hachura; **nunca zero** (04 L374). Mês vazio: caixa de zero medido. Para um vídeo, a ficha de 04 L518 ("incompleto", nunca "sem dados").

**Teste no Opera:** pedir, fechar a página, reabrir e ver "Há um pedido seu em andamento desde hh:mm…"; cancelar; ver "Incompleto" com os meses faltando marcados e o resto presente; arquivo desligado.

## 9. Peça 7: o arquivo pendente na fila "Saíram do YouTube"

**Propósito.** "Falta eu rodar algum comando?", com a contagem de pendências e a idade da mais velha (04 L59). Sobre a tela E do lote 1 (`e-sairam-do-youtube.html`), com selo.

**Seções:** frase-resumo (proposta: "3 itens esperam você rodar os comandos; o mais antigo há 34 dias."); barra de idade por item (0 a 60 dias, cortes em 30 e 60); a lista; "Ver os comandos" em dois tempos.

**Estados:** as linhas de 04 L392-400. Âmbar aos 30 dias, vermelho aos 60. "Já rodei" refutado em âmbar. Apagar bloqueado por mês fora das telas: a frase de D7, sem cor de erro e sem contar prazo (04 L393). Não medido: "Não foi possível ler se há cópia no arquivo." nunca "não há cópia".

**Teste no Opera:** "Ver os comandos" antes e depois da cópia nova conferida (os passos de apagar só aparecem depois); "Já rodei" refutado volta à lista; barra de idade de relance.

## 10. Peça 8: os vídeos antigos

**Propósito.** "Onde foram parar os vídeos velhos deste canal, e o que eu ainda vejo deles?", com a contagem em três partes e a data de cada número (04 L60).

### 10.1 Nas telas de canal e vídeo (quadros no 19, `canal-video.html`)

- **Barra de três segmentos** sob a contagem "93 vídeos: 41 acompanhados, 12 em leitura mensal, 40 no arquivo (publicados antes de mm/aaaa)": acompanhados cheio `--muted`; em leitura mensal 40% de `--muted` em `rgba` literal com o contorno do ◐; no arquivo só o contorno sólido `--dim` sobre `--sunk`. Segmento com 0 fica na legenda na caixa de zero medido; menos de 4 px vira 4 px; parcela não lida em hachura, total "pelo menos N vídeos" (04 L483). A 390 px a frase quebra em 3 linhas e a barra vai abaixo em largura total (04 L548).
- **Grupo recolhido "No arquivo (N)"**, "N vídeos com mais de 2 anos estão no arquivo" (singular: "1 vídeo com mais de 2 anos está no arquivo"; zero: o grupo não aparece, a contagem diz "0 no arquivo" na caixa de zero), 25 por vez com "Mostrar mais 25" (04 L483, L550-551).
- **Vídeo em leitura mensal:** fica onde estava, com a marca "em leitura mensal desde dd/mm" e "lido em dd/mm"; na página do vídeo, a frase de 04 L476, a média com "até dd/mm" e o gráfico com linha cheia até a passagem, pontilhado depois e pontos isolados com data (04 L486).
- **Vídeo no arquivo:** "No arquivo desde dd/mm. Aqui ficam o título, a data e as views…" + "Ver antigo"; número em destaque "12,3 mil views, lido em 03/01" e de apoio "na passagem à leitura mensal: 12,1 mil views, lido em 28/11" (04 L29, L485).
- **As outras telas:** uma linha cada (Trocas, Outliers e Comparar, comentários de destaque e "O criador responde", "Outras mudanças", Perguntar a uma IA, fixar, leitura mensal parada), com as frases de 04 L487-496.

### 10.2 Na página do Arquivo: a seção "Vídeos antigos"

Frase-resumo: "Vídeos antigos: 148 passaram à leitura mensal em dezembro de 2026. Podem ir para o arquivo a partir de 28/01/2027." Régua de quatro etapas por mês (No NAS, No B2, Recuperação, Miniaturas). Estados e frases: 04 L502-514; a confirmação com a frase digitada, 04 L516. Simulação de 45 canais: tabela com cabeçalho fixo e rolagem interna (04 L551). Carregamento por requisição, esqueleto com a altura final.

### 10.3 O que o dono testa no Opera (peça 8)

1. Canal com 41/12/40 e o mesmo canal em dezembro de 2026 (52/0): as três partes somam, o 0 aparece na caixa.
2. Canal que publica pouco: o ⓘ diz "nenhum vídeo sai antes disso".
3. Página do vídeo em leitura mensal: dá para dizer de quando é cada número.
4. ◐ a 16 px contra o pontilhado e a caixa, em escala de cinza.
5. "Mostrar mais 25" em 312 vídeos.

## 10b. Peça 4: o interruptor do automático (no topo de cada cartão de tipo)

**Propósito.** "Está ligado? Vai tirar algo sem eu ver? Parou por quê?", com o estado e a data (04 L56).

**Forma:** duas barras curtas lado a lado, "saídas feitas por você 1 de 3" e "simulações vistas 0 de 2" (04 L303, L413).

**Estados:** as linhas de 04 L303-312 (indisponível, desligado, ligar com a frase "ligar automático de views por dia", ligado, ligado com parte em dois passos, perto de vencer, desligou sozinho, chip fora da página, travado pela configuração, não medido) e **um quadro por motivo de desligamento** (motivos 1 a 11 e 13; o 12 está retirado e não ganha quadro: 04 L316-330). Cores: ligado = visto cinza com o verde pequeno; desligou sozinho = triângulo âmbar até o dono abrir; não medido = hachura com "nada sai sozinho". As quatro recusas que não desligam **não aparecem como problema** (04 L332).

**Teste no Opera:** ler o "desligou sozinho" de cada motivo e achar o "o que fazer"; ligar exige a frase; o chip na faixa some depois de abrir a peça.

---

## 11. Pontos para o Logan decidir (bloqueiam o desenho só onde marcado)

1. **Conflito de vocabulário com CONV §1.8.** As convenções do lote 2 proíbem "snapshot" e "lido" na tela; o spec 04 fixa "snapshot do NAS" (L31) e "lido em dd/mm" (L29) como vocabulário de tela. Plano: **o spec manda** (é mais novo e específico), e a CONV ganha uma nota no 19. Logan confirma.
2. **"Apagar do arquivo" sem frase digitada** (04 L556): é sem volta, como os comentários e os vídeos antigos, que têm frase. Proposta: digitar o nome do canal (ou o código interno de 8 caracteres no `sem_destino`).
3. **Duas leituras no diálogo de remover** (D5 e D8): a falha da contagem do banco mantém a remoção (aprovado); a do arquivo a bloqueia (04 L271). Plano: as duas convivem; se só a do banco falhar, vale o aprovado. Logan confirma.
4. **"Mockup 18" no diálogo de remover** (04 L270-271): o 18 aprovado não tem diálogo. Plano: desenhar só sobre a tela Canais e registrar a linha "18" da tabela de sincronia como "sem quadro: o 18 não tem diálogo". Confirma.
5. **Parcela no arquivo nas contagens do diálogo** (04 L494): o apoio "420 no banco, 392 no arquivo" é proposta deste plano.
6. **Cor de "a casa não respondeu"**: o spec diz "octógono ou triângulo com a data" (04 L415) e "vermelho" na mudança (03 L50). Proposta: triângulo até 36 h, octógono a partir de 36 h (o limite do motivo 2 do automático, 04 L319).
7. **"Quem ocupa" com o mês destacado** (18-v2): a sub-linha proposta em 3.4.
8. **Frase-resumo da página do Arquivo** e da fila (6.1, 9): o spec não as dá; as deste plano são propostas.
9. **"Arquivo" com dois sentidos** (ficheiro e arquivo-morto) na mesma tela (04 L556): sugestão, onde é ficheiro, "a cópia de <mês> no NAS" no lugar de "o arquivo de <mês> no NAS", **sem mudar** as frases já fixadas pelo spec sem o acordo dele.
10. **Casa fora no diálogo** (D6): o spec põe a frase depois de "Depois do clique"; o plano a mostra antes e depois do clique.

---

## 12. Para o `ROTEIRO-DE-TESTE-E-MELHORIAS.md`

Quando os mockups existirem, o roteiro ganha (04 L444):

- **Seção "19. O que muda quando um mês sai"**, com os seis blocos do roteiro; o bloco "Roteiro de teste" é a soma dos itens "O que o dono testa no Opera" das seções 2, 5, 6, 7, 8, 9, 10 e 10b deste plano.
- **Seção "18-v2"**, com os itens de 3.6.
- **Em cada mockup tocado** (13, 15, página do canal, 16b, histórico e fixar, muitas versões, 17a, 17b, 20, 21, 22, tela Canais, fila E), a seção "O que a fase de manutenção muda", com a linha da tabela de 04 L449-465.
- **Antes de o 19 ir ao dono:** conferir o quadro-resumo do roteiro contra `APROVACOES-DO-DONO.md` (04 L444). Conferido hoje: o roteiro já diz "18 … APROVADO (13/10, tarde)"; falta conferir 13 e 15.
