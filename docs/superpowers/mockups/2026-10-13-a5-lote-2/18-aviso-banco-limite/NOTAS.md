# Mockup 18: aviso "banco chegando ao limite" (A5, lote 2)

Atualizado na rodada do retorno do dono (13/10): a tela fala em PERCENTUAL do limite do banco inteiro do site; os MB só aparecem no botão de informação (seção 7). As seções 1 a 4 abaixo já estão no padrão novo; as seções 5 e 6 são o histórico das revisões r1 e r2 (feitas quando a tela ainda mostrava MB e "lotes") e ficam como estavam.

Abrir: `cd` nesta pasta, `python3 -m http.server <porta 47710-47790> --bind 127.0.0.1`, `index.html?caso=<estado>&painel=aberto|fechado&tema=claro`. O seletor "Estados do mockup" no topo troca de estado, de painel e de tema. Peças: `index.html`, `bl.css`, `bl.js`, mais cópia congelada de `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` (lote 1; nada editado). Plano: `PLANO.md`. Capturas: `shots/` (rodada do retorno do dono: 15 telas x 4 cruzamentos = 60, todas refeitas; `medidas.json` sem rolagem horizontal, sem texto menor que 12 px, sem alvo menor que 44 px a 390). Todo número é exemplo (marca "exemplo" na tela); nada é dado real do dono.

Fonte: spec 06 (seção 9.2, linha 131; item 80, linha 345) e 04 (tabela 6.5b, linha 159, mockup 18).

## 1. Decisões de desenho e por quê

1. **Mesma posição e família de forma da tela D.** A pastilha mora na faixa de frescor, depois de "todos em dia", com contorno tracejado e "+ novo"; o painel abre logo abaixo do cabeçalho, também em "+ novo". Quando o aviso de leitura por hora (D) e este coexistirem, as duas pastilhas ficam lado a lado e quebram de linha a 390 px (a faixa já tem `flex-wrap`). Aqui a D não foi desenhada junto, para não competir.
2. **Quieta quando está bem.** Verde e "não medido" não colorem a borda da pastilha; amarelo e vermelho colorem (`--warning`, `--danger`), e a cor mora só na pastilha do banco (a faixa "7 canais, sincronizado, todos em dia" não ganha contorno de alarme). O painel segue a mesma regra: **fechado** nos estados calmos (com folga, zero medido, previsão não medida, exportações a confirmar), **aberto** onde pede ação ou desconfiança (enchendo, quase cheio, acima do limite, sem leitura, erro, sem medida). (Na mostra, por pedido da revisão r2, zero medido, previsão não medida e exportações a confirmar abrem o painel por padrão, para o dono julgar a distinção; em produção seguem fechados e só "Com folga" usa a escolha lembrada. Fechado, o painel some inteiro, sem moldura vazia.) A escolha do dono nos estados calmos é lembrada no navegador (`localStorage`, com try/catch); nos de alerta o painel sempre abre e a escolha não é gravada, para um "fechei uma vez" nunca esconder um alarme futuro.
3. **A forma memorável é a barra de 0% a 100% do limite com os cortes de 70% e 85% desenhados** (linhas e zonas sombreadas atrás do preenchimento; o símbolo de cada zona e um traço de 3 px no topo ficam por cima do preenchimento, para nunca sumirem; a zona vermelha tem listras verticais, a âmbar é lisa). Dá para ver a distância até cada corte sem ler número. A mesma barra, reduzida (64 px, 48 px a 390), vai dentro da pastilha. O eixo diz 0%, 70%, 85%, 100%; o valor (43%) fica em cima do preenchimento. Acima do limite a barra enche inteira e o rótulo diz "104%" com "4% acima".
4. **Cor estável por significado e símbolo com forma própria** (lê em cinza): verde = círculo com visto; amarelo = triângulo com "!"; vermelho = octógono com "!" (família do erro: borda e ícone em `--danger`, texto da pastilha em `--text` por contraste); não medido = hachura rosa, a mesma de toda a pasta. Nenhum matiz novo.
5. **Vermelho por previsão aparece como vermelho mesmo com o tamanho em âmbar** (78% do limite): a pastilha diz "enche em 80 dias", a frase abre com "Banco do site enche em 80 dias" e a régua do tempo mostra o losango dentro da zona vermelha (a regra dos 90 dias fica na legenda da régua e no ⓘ). O preenchimento da barra segue a cor do TAMANHO (âmbar aos 78% do limite); o vermelho vai para a pastilha, o "enche em 80 dias" e o losango.
6. **Régua do tempo de 0 a 1 ano com a zona de 90 dias.** Datas além de 1 ano (jan/2030) ficam no fim da régua com "depois de 1 ano"; a data sempre está escrita. Zero crescimento: régua sem losango e a frase "não está crescendo".
7. **"Zero medido" e "não medido" distintos.** Zero = caixa vazada com borda `--im-zero` (crescimento "0%", "0 exportações"). Não medido = hachura rosa, com o motivo dito uma vez (poucos dias de leitura, sem a leitura de hoje, o banco não respondeu, ainda sem leitura) e, quando existe, a data em que passa a existir (21/10 e 27/10). "Ainda não existe" (os 14 dias de registro que faltam) = contorno pontilhado.
8. **"Sem leitura hoje" tem a forma de não medido, nunca verde.** A barra mostra o último valor em hachura tracejada ("12/10: 43%, leitura de ontem"); os números de hoje viram UMA linha com UMA pastilha "não medido" ("Hoje, quanto falta para o limite e quanto cresceu em 28 dias: falta a leitura de hoje"); a régua e "Quem ocupa" mostram só a hachura, sem pastilha e sem repetir o motivo. A frase não tranquiliza (nada de "com folga"). Pastilha e faixa não ganham cor de risco: não sabemos.
9. **Erro de leitura é "não medido" com botão "Tentar de novo" ao lado da frase (não embaixo da régua), não vermelho. O resultado da tentativa é anunciado por região `aria-live="polite"` ("Tentou às 14:41: o banco ainda não respondeu"). As exportações vêm de outra tabela e continuam aparecendo no erro.** Vermelho aqui significa "banco perto do limite"; pintar de vermelho uma consulta que falhou seria um falso alarme, e pintar de verde seria falso conforto. A frase diz isso.
10. **"Quem ocupa o banco do site" em parte percentual, com o Observatório como UMA parte** (retorno do dono). Barra empilhada em dois níveis: um colchete "Observatório 60%" por cima de concorrentes (azul `--lado-b`) e seu canal (laranja `--lado-o`), e "Resto do site 40%" ao lado (areia `--lado-n`). Tabela: Observatório (negrito) com os dois que o compõem recuados, Resto do site, e a linha "Banco do site 100%"; colunas "Do banco" (divide o tamanho de hoje) e "Do crescimento" (divide o que o banco cresceu em 28 dias). Cada coluna soma 100 pelo método do maior resto, e o Observatório é a SOMA dos dois filhos já arredondados (60 = 19 + 41). Sem MB no corpo. Sem crescimento (zero medido) a coluna "Do crescimento" não existe (não há o que dividir; 0 de 0 não é 0%) e a frase diz "o banco não cresceu em 28 dias"; sem medida de crescimento a coluna também some e a ausência fica dita uma vez no número "Cresceu em 28 dias".
11. **Exportações** (antes "lotes"): cartão com borda tracejada à esquerda (pendente), os três passos com a forma "feito" (círculo com visto) e "falta" (círculo pontilhado), nome do canal, período, registros, data e idade. A pastilha ganha "2 exportações a confirmar" (ícone de relógio). Confirmar é por comando, só do dono: a tela informa e o ⓘ explica; não há botão. A palavra "lote" não aparece em nenhum texto de tela (conferido por código: zero ocorrências fora do ⓘ).
11b. **Lugar reservado do backup no NAS** (fase futura): uma linha no pé do painel, contorno pontilhado `--dim`, ícone de armazenamento, "Backup no NAS ao chegar a um percentual do limite" e a etiqueta pontilhada "ainda não existe". Sem botão, sem campo, sem cor de estado; só com o painel aberto; uma linha a 1440, duas a 390. O ⓘ do banco diz o que será (ao chegar a um percentual, por botão ou agendado).
12. **Só leitura não vê nada**, nem pastilha desativada: a faixa fica como a produção. A tabela "Quando cada estado aparece" (fora da tela) registra isso.
13. **Método no ⓘ, e é o ÚNICO lugar com MB**: "Hoje, em MB: 216,0 MB de 500 MB = 43% do limite" com as três partes, o crescimento em MB e por dia, e a conta do dia ((500 − 216,0) ÷ 0,24 MB por dia = 1.187 dias). Nada de método em prosa na tela.
14. **Dois números, em percentual do limite**: "Ainda livre 57% do limite" (acima do limite: "Passou 4% do limite") e "Cresceu em 28 dias +1,3% do limite" (zero medido: caixa "0%"; não medido: hachura). O ritmo por dia e os MB ficam no ⓘ.
15. **Não há estado "carregando".** O aviso é desenhado no servidor junto com o cabeçalho (o implementador mantém assim); se um dia vier por requisição separada, desenhar a pastilha com a hachura e "Lendo o banco…".
16. **Conta sobre o que aparece, com fonte única** (retorno do dono): os dados de exemplo guardam só os MB de cada parte e o crescimento de cada parte em 28 dias; o tamanho é a SOMA das partes; o percentual mostrado é UM inteiro (arredondado uma vez) e a cor, o nome, a pastilha, a frase, a barra e o "ainda livre" (100 − esse inteiro) leem ESSE inteiro; as partes somam 100; a data prevista sai do mesmo crescimento por dia do ⓘ. A tabela de coerência por estado está na seção 7.

## 2. Tabela de frases (texto exato, depois do retorno do dono: percentual do limite, sem MB fora do ⓘ)

Os números variam por estado; aqui o exemplo de cada um. "Limite" é sempre o do banco inteiro do site.

| Onde | Texto |
|---|---|
| Pastilha, verde | "Banco do site: 43% do limite" |
| Pastilha, amarelo | "Banco do site: 72% do limite" + "limite em set/2028" |
| Pastilha, vermelho por tamanho | "Banco do site: 88% do limite" |
| Pastilha, vermelho por previsão | "Banco do site: 78% do limite" + "enche em 80 dias" |
| Pastilha, acima do limite | "Banco do site: 104% do limite" |
| Pastilha, sem leitura / erro / vazio | "Banco do site: sem leitura hoje" / "Banco do site: não foi possível ler" / "Banco do site: sem medida" |
| Pastilha, com exportação pendente | "2 exportações a confirmar" (singular: "1 exportação a confirmar") |
| Rótulos de estado (pastilha do painel), do mais calmo ao mais urgente | "Com folga" / "Enchendo" / "Quase cheio" (por tamanho) ou "Enche em 80 dias" (por previsão) / "Acima do limite"; sem medida: "Sem leitura hoje" / "Não foi possível ler" / "Sem medida" |
| Marca (só na mostra) | "exemplo" |
| Frase, verde | "Banco do site com folga: 43% do limite. No ritmo dos últimos 28 dias, chega ao limite em jan/2030." |
| Frase, amarelo | "Banco do site enchendo: 72% do limite. No ritmo dos últimos 28 dias, chega ao limite em set/2028." |
| Frase, vermelho por tamanho | "Banco do site quase cheio: 88% do limite. Passou dos 85%. No ritmo dos últimos 28 dias, chega ao limite em mai/2027." |
| Frase, vermelho por previsão | "Banco do site enche em 80 dias: 78% do limite, no ritmo dos últimos 28 dias." (a data, 01/01/2027, fica na régua; a regra, no ⓘ) |
| Frase, acima | "Banco do site acima do limite: 104% do limite." (o "Passou 4% do limite" ficou só na célula dos números e na barra, sem repetir na frase) |
| Frase, zero medido | "Banco do site com folga: 43% do limite. Nos últimos 28 dias o banco não cresceu: nesse ritmo ele não chega ao limite." |
| Frase, previsão não medida | "Banco do site com folga: 43% do limite. A previsão ainda não existe: há só 6 dias de leitura e são precisos 14." |
| Frase, sem leitura hoje | "Sem leitura do banco do site hoje. A medida das 05:00 não chegou; a última, de 12/10, foi 43% do limite." |
| Frase, erro | "Não foi possível ler o tamanho do banco do site. O banco não respondeu, então nada indica que está tudo bem nem que está ruim." |
| Frase, vazio | "Ainda sem medida do tamanho do banco do site. A primeira leitura é em 14/10, às 05:00. Antes disso não há dado." |
| Legenda da barra | "até 70%: com folga" / "70% a 85%: enchendo" / "acima de 85%, ou cheio em menos de 90 dias: quase cheio" |
| Eixo da barra | 0%, 70%, 85%, 100% |
| Rótulo acima da barra | "43%"; acima: "104%" + "4% acima"; sem leitura: "12/10: 43%" + "leitura de ontem" |
| Números (rótulo, valor, subtítulo) | "Ainda livre" 57% "do limite"; acima: "Passou" 4% "do limite"; "Cresceu em 28 dias" +1,3% "do limite"; zero medido: caixa "0%" + "medido: o banco não mudou"; não medido: hachura + "só 6 dias de leitura". Sem tamanho de hoje, uma linha: "Hoje, quanto falta para o limite e quanto cresceu em 28 dias: falta a leitura de hoje." (ou "o banco não respondeu" / "ainda não há leitura") |
| Título da régua | "Quando chega ao limite" |
| Dados da régua | marca "01/01/2027" ou "jan/2030" + "depois de 1 ano"; zero medido: "sem data" + "não está crescendo"; acima: "já passou" |
| Eixo da régua | "hoje", "90 dias", "1 ano" |
| Legenda da régua | "menos de 90 dias até o limite: vermelho, qualquer que seja o tamanho de hoje" |
| Previsão não medida (hachura, sem pastilha) | "Poucos dias de leitura: faltam 8 dias. A previsão passa a existir em 21/10." / "Volta quando a leitura das 05:00 chegar." / "Volta quando o banco puder ser lido." / "Passa a existir em 27/10, quando houver 14 dias de leitura." |
| Quem ocupa: título e frase | "Quem ocupa o banco do site"; "O Observatório ocupa 60% do que o banco do site ocupa e responde por 74% do que o banco cresceu em 28 dias." (zero medido: "O Observatório ocupa 60% do que o banco do site ocupa, e o banco não cresceu em 28 dias."; sem medida de crescimento: "..., e o crescimento ainda não foi medido.") |
| Quem ocupa: barra | colchete "Observatório 60%" sobre concorrentes + seu canal; "Resto do site 40%" ao lado |
| Quem ocupa: tabela | colunas "Parte", "Do que está ocupado", "Do crescimento" (a última mostra "não medido" em hachura quando o crescimento não foi medido e some só em zero medido, onde a frase explica); linhas "Observatório" (negrito), "Concorrentes" e "Seu canal" (recuadas), "Resto do site"; total "Banco do site" 100% |
| Quem ocupa, sem dado (hachura, sem pastilha) | "Volta com a próxima leitura." / "Volta quando o banco puder ser lido." / "Aparece com a primeira leitura." |
| Exportações: título | "Exportações" (com ⓘ "Como confirmar uma exportação") |
| Exportações: zero | "0 exportações esperando a sua confirmação." (caixa de zero medido; no erro ao ler vira "não medido": "As exportações também vêm do banco, que não respondeu: não dá para dizer se alguma espera confirmação.") |
| Exportações: frase | "2 exportações esperam a sua confirmação. Os dados continuam no banco até você confirmar." (singular: "1 exportação espera a sua confirmação.") |
| Exportação: linha 1 | "Aldinho" + "jan/2025 a set/2026 · 118.402 registros" |
| Exportação: passos | "Exportado em 09/10", "Conferido em 09/10" ou "Conferido: falta", "Confirmado no NAS: falta" |
| Exportação: pendência | "Falta você confirmar no NAS. Exportado há 4 dias. Nada foi apagado." / "Falta conferir o arquivo. Exportado há 1 dia. Nada foi apagado." |
| Lugar do NAS (só painel aberto) | "Backup no NAS ao chegar a um percentual do limite" + etiqueta "ainda não existe" |
| Botão do erro (ao lado da frase) | "Tentar de novo" (em espera: "Lendo o banco…"; depois: "Tentou às 14:41: o banco ainda não respondeu.") |
| ⓘ do banco (título "Como o tamanho do banco do site é medido") | O que é (o banco INTEIRO do site, não só o Observatório; medido uma vez por dia, 05:00; do próprio banco, não do YouTube); Limite (500 MB para o banco inteiro; a tela mostra só o percentual, os MB ficam aqui); **Hoje, em MB** (216,0 MB de 500 MB = 43% do limite, com as três partes); **Crescimento, em MB** (+6,7 MB em 28 dias = 1,3% do limite, 0,24 MB por dia, por parte); "Enchendo" (70%, 350 MB); "Quase cheio" (85%, 425 MB, ou previsão ao limite em menos de 90 dias); Previsão (reta dos últimos 28 dias; dias = (500 MB − tamanho de hoje) ÷ crescimento por dia); "Conta de hoje" com os números; menos de 14 dias de leitura = "não medida"; sem a leitura de hoje = "sem leitura hoje", nunca verde; Quem ocupa (Observatório = concorrentes + seu canal, uma parte do banco; cada coluna soma 100%); Backup no NAS (ainda não existe; será ao chegar a um percentual, por botão ou agendado) |
| ⓘ das exportações (título "Como confirmar uma exportação") | Exportado (o sistema salvou os arquivos); Conferido (mesmo número de registros e mesmo código de conferência da lista feita na exportação); Confirmado no NAS (só o dono, depois de copiar e conferir lá; o site não confirma nem apaga sozinho); "Enquanto não confirmar, nada é apagado do banco e o canal não pode ser removido." |

## 3. Dúvidas para o dono (padrão adotado)

1. **Só leitura: nada na tela ou uma linha dizendo que existe?** O pedido diz "não vê o aviso"; a regra 13 do lote diz que a tela de só leitura "diz o que ele não vê". Adotei **nada** (faixa como a produção), porque quem não pode agir não ganha nada com a linha. Mudar é uma linha de texto.
2. **Erro ao ler o banco: hachura de "não medido" (adotado) ou família do erro?** Adotei hachura com "Tentar de novo" para o vermelho significar só "quase cheio".
3. **Exportação pendente há muito tempo vira alerta?** Adotei neutro (borda tracejada, relógio), só com a idade escrita; o spec não define prazo. Sugestão: amarelo depois de 14 dias, se o dono quiser.
4. **Mostrar quanto cada exportação liberaria no banco (em % do limite)?** Deixei de fora: a tabela de exportações não guarda bytes, só registros (linhas). Seria uma conta nova.
5. **Quebra em três partes (acréscimo "resto do site")**, para fechar com o total. O pedido dizia concorrentes × canal próprio.
6. ~~Frase de "sem leitura hoje" citava a faixa da última leitura~~: resolvido na rodada r1, a frase só diz o número ("foi 43% do limite"), sem "com folga".

### Dúvidas novas desta rodada (padrão adotado em cada uma)

7. **Os MB aparecem no botão de informação ou em lugar nenhum?** Adotei: **só no botão de informação** (tamanho de hoje e crescimento em MB, as três partes e a conta da previsão), como o dono sugeriu ("não falar os valores", mas quem quiser a conta a encontra). Tirar de lá é cortar duas linhas do ⓘ.
8. **O lugar reservado do NAS fica ou sai?** Adotei: **fica**, uma linha pontilhada no pé do painel ("Backup no NAS ao chegar a um percentual do limite" + "ainda não existe"), sem botão e sem campo, só com o painel aberto. Custa uma linha a 1440 e duas a 390; sai apagando a constante `NAS` em `bl.js`. Se ficar, falta o dono dizer o percentual de gatilho (sugestão: o mesmo 85%, o corte do vermelho) e se é botão, agendamento ou os dois.
9. **"Quem ocupa" divide o quê?** Adotei: **% do banco ocupado hoje** (soma 100, sem incluir o espaço livre) e **% do crescimento de 28 dias**. A alternativa é dividir o LIMITE (por exemplo Observatório 26% + resto 17% + livre 57% = 100%): bate com a barra de cima, mas vira "26%" ao lado de "43%" e confunde. Se o dono preferir a base do limite, é uma mudança de cálculo, não de desenho.
10. **"Observatório" = concorrentes + seu canal?** Adotei sim: o Observatório é a soma das duas partes que a tela já mostrava; o que não é dele é "Resto do site". Se algum dado do Observatório mora fora dessas duas colunas (`competitor_bytes`, `own_bytes`), o "resto" está maior do que devia.
11. **Acima do limite: "104%" literal.** Adotei o percentual real (104%) com "Passou 4% do limite", em vez de "100%+" ou "cheio", porque a pergunta do dono é "quanto passou". A barra enche inteira e o rótulo diz "4% acima".
12. **"Exportações" no lugar de "lote".** Padrão adotado até o dono dizer outra coisa; o código da A4 tem teste que proíbe "lote" em frase de tela.
13. **Percentual inteiro, sem casa decimal, na pastilha e na frase** (43%, não 43,2%), e uma casa só em "Cresceu em 28 dias" (+1,3%), porque o crescimento de 28 dias é pequeno. Os cortes (70% e 85%) valem para o inteiro mostrado.


## 4. O que o implementador precisa saber

- **Dado:** `obs_db_size_daily` (`day`, `db_bytes`, `competitor_bytes`, `own_bytes`), gravada pela tarefa `tamanho_do_banco` da agenda (05:00 de São Paulo); exportações (`obs_archive_batches`) (`row_count`, `exported_at`, `verified_at`, `nas_confirmed_at`, `deleted_at`). Sem migration nova de tela (MG6 já traz as duas). "Resto do site" = `db_bytes − competitor_bytes − own_bytes`.
- **Permissão:** o aviso inteiro (pastilha, painel, exportações) só é desenhado quando `can_edit_site(site_id)`; a leitura de exportações tem RLS por `can_edit_site`, a do tamanho por `is_member_staff()`. Quem não edita recebe a faixa sem a pastilha, não uma pastilha vazia.
- **Estado do dia:** "sem leitura hoje" = não existe linha com `day` igual ao dia de São Paulo; nunca derivar o estado da última linha antiga. Verde só com linha de hoje.
- **Regras de cor, em percentual do limite:** calcule UMA vez o inteiro `round(tamanho ÷ 500 × 100)` e decida o estado, a cor e todo texto sobre ESSE inteiro: amarelo a partir de 70; vermelho a partir de 85 **ou** previsão ao limite em menos de 90 dias (só se a previsão for medida: com menos de 14 dias de leitura ela não pode pintar de vermelho nem de verde); acima de 100, "Acima do limite" com o percentual real (104%) e quanto passou (4%). Teste de borda nos inteiros mostrados (69/70, 84/85, 100/101) e em dias (89/90). Os dias até o limite saem dos MB exatos (a conta do ⓘ); refeita com os percentuais arredondados dá até 1 dia de diferença (80 contra 81), e isso é esperado.
- **Percentuais que somam 100:** "Do que está ocupado" e "Do crescimento" por maior resto; o Observatório é a soma dos dois filhos já arredondados; "Do crescimento" só existe se o banco cresceu (0 de 0 não é 0%).
- **MB:** só dentro do ⓘ; nenhum outro elemento da tela os mostra (conferido por código, ver seção 7).
- **Previsão:** o spec diz "a reta dos últimos 28 dias" sem dizer o método. O mockup usa o crescimento por dia = inclinação da reta; o implementador escolhe (dois pontos ou mínimos quadrados), documenta e usa o mesmo número na frase, nos quatro números, na régua e no ⓘ. Crescimento zero ou negativo = "sem data", nunca "infinito" nem "sem risco".
- **Fuso:** "hoje" e as datas são de São Paulo; as 05:00 só aparecem nos textos de "sem leitura" e do ⓘ.
- **Acessibilidade já desenhada:** a pastilha é um `button` com `aria-expanded` e `aria-controls`; as barras e a régua são `role="img"` com texto por extenso; o painel é `role="region"`; a tabela da quebra tem `caption` (só para leitor de tela) e `scope`; alvo de 44 px a 390 px; `prefers-reduced-motion` respeitado. Leitor de tela e Safari/Opera não foram verificados.
- **CSS:** classes `bl-*`; nenhum `color-mix()`; tokens do lote 1 ("lote 1" aqui é a pasta aprovada do projeto, não texto de tela). Não reutilize a classe `.nm` em elemento de layout (ela traz borda e preenchimento): a hachura de barras usa `.vz`.
- **Fora do alcance:** "Ver antigo", arquivar por idade e o banco no NAS são da fase de manutenção; esta tela só informa as exportações pendentes e reserva uma linha, marcada "ainda não existe", para o envio ao backup no NAS ao chegar a um percentual (por botão ou agendado).
- **O que não foi verificado:** contraste medido no navegador (só olhado nas capturas), foco por teclado em todos os controles, comportamento do popover do ⓘ em telas de toque reais.

## 5. Resposta à revisão r1 (`REVISAO-UX-r1.md`)

Todos os itens aceitos; nenhum desacordo. Capturas refeitas (60, ver acima) e conferidas nos estados afetados.

- **B1 (zonas da barra não liam em cinza):** aceito. Cada zona leva o seu símbolo por cima do preenchimento (triângulo na de 350 a 425, octógono na de 425 a 500) e um traço de 3 px no topo; o corpo das zonas subiu para 3,4:1 (âmbar) e 3,5:1 (vermelha) contra o trilho no escuro e 3,4:1 e 3,9:1 no claro (medido; antes 1,6/1,4 e 1,3/1,4). Âmbar contra vermelha continua perto em luminância (1,0 a 1,2:1), por isso a vermelha ganhou listras verticais (a hachura de 135 graus segue só do "não medido") e os símbolos têm forma diferente.
- **B2 (parede de "não medido" e frase sobre o próprio aviso):** aceito. Sem leitura/erro/vazio: uma linha com uma pastilha no lugar dos quatro números; régua e "Quem ocupa" só com a hachura; cortados "o aviso não pode ficar verde" e "(com folga)". Pastilhas "não medido" no painel: de 7-8 para 2 (a do estado e a da linha de números).
- **B3 (painel aberto à toa):** aceito. Padrão por estado (fechado nos calmos, aberto nos de alerta), escolha lembrada nos calmos; decisão 2 e tabela fora da tela. Lotes a confirmar fica fechado (a pastilha já diz "2 lotes a confirmar"); se o dono preferir aberto, é uma linha.
- **C1 (pastilha do painel sem símbolo):** aceito. A amostra de hachura aparece na pastilha (regra `display:none` apagada).
- **C2 (pastilha da faixa quebrava no meio da frase a 390):** aceito. "Banco: N de 500 MB" com a minibarra é uma unidade que não quebra; "enche em N dias", "limite em mês/ano" e "N lotes a confirmar" passam inteiros para a linha de baixo; o chevron fica fixo à direita; 44 px mínimos.
- **C3 (nomes quase iguais):** aceito. "Enchendo" < "Quase cheio" (ou "Enche em 80 dias", quando o motivo é a previsão) < "Acima do limite", em pastilha, frase, legenda, ⓘ e tabela fora da tela.
- **C4 (número repetido):** aceito. Cortadas as células "Hoje" e "Chega a 500 MB": sobram "Livre até 500 MB" e "Cresceu em 28 dias".
- **C5 (frase da previsão repetia e carregava a regra):** aceito. "Banco enche em 80 dias: 392 de 500 MB (78%), no ritmo dos últimos 28 dias." A data fica na régua, a regra de 90 dias na legenda da régua e no ⓘ.
- **Sugestão 1 (tabela a 390):** feita (nome sem quebra, cabeçalho "Em 28 dias").
- **Sugestão 2 (preenchimento do vermelho por previsão):** feita (cor do tamanho; o vermelho vai para pastilha, texto e losango).
- **Sugestão 3 (borda de alarme na faixa inteira):** feita (só a pastilha).
- **Sugestão 4 (carregando e aria-live):** feita (decisão 15 e região `aria-live` do "Tentar de novo").
- **Sugestão 5 ("Tentar de novo" longe da frase):** feita (ao lado da frase).
- **Sugestão 6 (lotes no erro):** feita (lotes aparecem normalmente).
- **Sugestão 7 (zero em tudo é suspeito):** feita no ⓘ do zero medido.
- **Sugestão 8 (jargão):** feita ("o banco não respondeu", "salvou", "registros", "dias de leitura", manifesto e soma de controle trocados por frase simples no ⓘ).
- **Sugestão 9 (o "quando" com o painel fechado):** feita no amarelo ("limite em set/2028" na pastilha).
- **Sugestão 10 (octógono igual em "quase cheio" e "acima"):** não feita; o texto diferencia ("Acima do limite" + "21 MB acima") e as listras da zona somam um traço distinto. Reabrir se o dono quiser um "×".
- **Sugestão 11 (aria):** feita junto com a 4.
- **Fora do que consegui verificar** (igual à revisão): leitor de tela, Safari/Opera, toque em aparelho real, fontes da web.

## 6. Resposta à revisão r2 (`REVISAO-UX-r2.md`)

Todos os itens aceitos; nenhum desacordo. Capturas refeitas (60, `shots/`, com `medidas.json`: 0 rolagem, 0 fonte menor que 12 px, 0 alvo menor que 44 px a 390) e conferidas abrindo verde 1440 escuro e 390 claro, zero medido 1440 escuro e previsão não medida 390 claro.

- **N1 (quadro tracejado vazio com "+ novo" quando o painel está fechado; bloqueava):** aceito. O invólucro `.bl-n` também ganha `hidden` (id `bl-wrap`) e a pastilha o alterna junto com o painel; CSS `.bl-n[hidden]{display:none}`. Conferido: entre as abas e a Lista de Canais não sobra nada, a 1440 e a 390.
- **N2 (sem a marca "exemplo" com o painel fechado; corrige):** aceito. `<span class="ex">exemplo</span>` ao lado da pastilha na faixa (só na mostra; classe `bl-exf`), nunca no estado só de leitura (não há pastilha). A 390 ela cai para a linha de baixo da faixa, sem rolagem.
- **N3 (zero medido e previsão não medida fechados eram idênticos ao verde; corrige):** aceito. Na mostra, esses dois estados e "Lotes a confirmar" abrem o painel por padrão (`?painel=` ainda força); só "Com folga" usa a escolha lembrada, e os três não gravam essa escolha, para a mostra não mexer no verde. Produção não muda. Os quatro PNGs (verde, zero medido, previsão não medida, lote pendente) agora têm conteúdo diferente (MD5 distintos). Tabela fora da tela e decisão 2 atualizadas.
- **Sugestões 1 a 3 (zona vermelha da régua e barra em estado calmo/não medido; tracinho da ultrapassagem):** não feitas, não bloqueiam; ficam para o dono dizer se quer (cada uma é uma regra de CSS).
- **Sugestão 4 (âmbar e laranja do tema claro quase iguais):** herança dos tokens do lote 1; registrado aqui como aviso ao dono, sem mexer no token.
- **Sugestão 5 (motivo repetido em "previsão não medida" e "sem leitura"):** não feita; aceitável segundo a própria revisão.
- **Sugestão 6 (fontes da web bloqueadas na captura):** limitação da captura, igual ao lote 1; larguras reais podem diferir poucos pixels.
- **Fora do que consegui verificar:** leitor de tela, Safari/Opera, toque em aparelho real, fontes da web; o popover do ⓘ com painel aberto não foi reaberto por mim (não mudou), só o alternador do invólucro, lido no código.

## 7. Resposta ao retorno do dono (13/10) e coerência por estado

O dono reprovou a versão anterior: "500 MB é para tudo, não é só para isso, né? Então talvez exibir percentual, mas não falar os valores e tal. Talvez até ter um botão ou cron em quando chegar em algum percentual mandar para o nosso backup no NAS eventualmente." Plano da rodada: `PLANO.md`, seção "Rodada do retorno do dono". Resposta, item por item (os itens são os de `RETORNO-DO-DONO-13-10.md`):

1. **O limite é do banco inteiro, não do Observatório.** Feito. A pastilha diz "Banco do site: 43% do limite"; toda frase começa por "Banco do site"; o ⓘ diz que o limite é de todo o banco do site, não só do Observatório. Em "Quem ocupa o banco do site" o Observatório é uma parte (colchete sobre concorrentes + seu canal) ao lado de "Resto do site".
2. **Percentual em vez de valores.** Feito: pastilha, minibarra, barra (eixo 0%, 70%, 85%, 100%), frase, "Ainda livre 57% do limite", "Cresceu em 28 dias +1,3% do limite", rótulo da barra e última leitura ("12/10: 43%"). Nenhum "MB" fora do ⓘ (verificado por código nos 12 estados: 0 ocorrências). O ⓘ guarda os MB e a conta.
3. **Cortes em 70% e 85%.** Feito na legenda, no eixo, nas linhas e zonas da barra, na minibarra, no ⓘ (com os MB entre parênteses) e nas regras do implementador (inteiro mostrado: 69/70, 84/85, 100/101). A previsão continua em dias e data ("enche em 80 dias", "jan/2030" na régua, que nunca usou MB).
4. **"Quem ocupa" em parte percentual, com o Observatório como uma parte.** Feito: barra com colchete, tabela "Do que está ocupado" e "Do crescimento" (cada coluna soma 100; Observatório = soma dos dois que o compõem). Zero crescimento: a coluna de crescimento não existe (não há o que dividir) e a frase diz "o banco não cresceu em 28 dias".
5. **Lugar reservado do NAS.** Feito: linha pontilhada discreta com "ainda não existe", sem botão (dúvida 8 pergunta se fica).
6. **"Lote" vira "exportação".** Feito em pastilha, frase, título, cartões, ⓘ, barra de estados e tabela fora da tela (o estado agora é `?caso=exportacoes`; o link antigo `lote-pendente` continua abrindo o mesmo estado).

**Como "acima do limite" se lê em percentual:** pastilha "Banco do site: 104% do limite" (octógono vermelho), "Acima do limite"; barra inteira cheia com o rótulo "104%" + "4% acima"; frase "Banco do site acima do limite: 104% do limite."; célula "Passou 4% do limite"; régua "já passou". **Como a previsão fica clara sem MB:** a unidade da previsão sempre foi tempo; a pastilha diz "enche em 80 dias", a régua mostra a data (01/01/2027) e a zona dos 90 dias, e a conta em MB mora no ⓘ.

### Tabela de coerência por estado (gerada por código a partir da fonte única; conferida na tela, 1440, painel aberto)

Cada linha confere, por script, que o mesmo inteiro aparece na pastilha, na frase e na barra; que "ainda livre" = 100 − esse inteiro (acima: inteiro − 100); que o crescimento mostrado é a soma das partes ÷ 500; que as partes somam 100 e o Observatório é a soma dos dois filhos; que os dias da pastilha, da frase e da régua são os mesmos; e que "MB" e "lote" não aparecem fora do ⓘ (última coluna: ocorrências de MB / de lote). Resultado da última rodada: **tudo coerente, 0 falhas**.

| Estado | MB → % mostrado | Cor | Parte do banco (conc + canal + resto) | Parte do crescimento | Cresceu (% do limite) | Dias até o limite → data | "MB" / "lote" fora do ⓘ |
|---|---|---|---|---|---|---|---|
| verde | 216 MB → 43% | verde | 19 + 41 + 40 = 100 | 43 + 31 + 26 = 100 | +1,3% | 1187 d → 12/01/2030 (pela conta em %: 1191 d) | 0/0 |
| amarelo | 360 MB → 72% | amarelo | 31 + 37 + 32 = 100 | 43 + 34 + 23 = 100 | +1,1% | 700 d → 12/09/2028 (pela conta em %: 700 d) | 0/0 |
| vermelho-tamanho | 440 MB → 88% | vermelho (tamanho) | 39 + 32 + 29 = 100 | 55 + 25 + 20 = 100 | +1,7% | 200 d → 01/05/2027 (pela conta em %: 200 d) | 0/0 |
| vermelho-projecao | 392 MB → 78% | vermelho (previsao) | 40 + 31 + 29 = 100 | 64 + 23 + 13 = 100 | +7,6% | 80 d → 01/01/2027 (pela conta em %: 81 d) | 0/0 |
| acima | 521 MB → 104% | vermelho (tamanho) | 39 + 31 + 30 = 100 | 55 + 25 + 20 = 100 | +1,7% | 0 d → 13/10/2026 (pela conta em %: -67 d) | 0/0 |
| sem-crescimento | 216 MB → 43% | verde | 19 + 41 + 40 = 100 | sem crescimento | +0,0% | zero | 0/0 |
| projecao-nm | 216 MB → 43% | verde | 19 + 41 + 40 = 100 | — | — | nm-poucos | 0/0 |
| sem-leitura | sem tamanho de hoje; última leitura 214,8 MB → 43% | nm | — | — | — | nm-sem | 0/0 |
| exportacoes | 216 MB → 43% | verde | 19 + 41 + 40 = 100 | 43 + 31 + 26 = 100 | +1,3% | 1187 d → 12/01/2030 (pela conta em %: 1191 d) | 0/0 |
| erro | — MB → —% | nm | — | — | — | nm-erro | 0/0 |
| vazio | — MB → —% | nm | — | — | — | nm-vazio | 0/0 |
| so-leitura | só leitura: o aviso não é desenhado (verificado: nenhuma pastilha na faixa) | | | | | | |

Observações da tabela: (a) "pela conta em %" refaz os dias com os percentuais já arredondados; a diferença máxima é de 1 dia (80 contra 81 no vermelho por previsão) e vem do arredondamento do inteiro; a tela usa os MB exatos (a conta do ⓘ). (b) Em "acima", a conta em % dá negativo porque o banco já passou do limite; a tela diz "já passou", nunca um número negativo. (c) Sem crescimento: o "+0,0%" da tabela é só a linha do script; na tela é a caixa "0%" (zero medido) e a frase "não está crescendo".

### O que não foi verificado nesta rodada
Contraste medido no navegador (só olhado nas capturas), leitor de tela, Safari/Opera, toque em aparelho real, fontes da web (a captura as bloqueia). A rodada 4 do `revisor-ux-senior` já foi feita e respondida na seção 8.

## 8. Resposta à revisão r4 (`REVISAO-UX-r4.md`) e coerência por estado, refeita

Veredito da r4: zero bloqueio, 2 "corrige". Os dois estão resolvidos; das 10 sugestões, 8 foram feitas (edições de poucas linhas em `bl.js` e `bl.css`) e 2 ficam como estão.

| Item da r4 | O que foi feito |
|---|---|
| C1 (`aria-label` da régua em "acima do limite" dizia "chega ao limite em out/2026, daqui a 0 dias") | Quando os dias são 0 o `aria-label` diz "Previsão: o banco já passou do limite." (a mesma frase da tela). Conferido no DOM em 1440 e 390. |
| C2 (concorrentes e seu canal só se distinguem por cor; em cinza viram o mesmo) | Cada parte ganhou uma textura além da cor, na barra e no quadradinho da tabela: concorrentes liso, seu canal listrado na diagonal, resto do site pontilhado (`rgba` literal, sem `color-mix`). Conferido abrindo `shots/index-caso-amarelo-390-claro.png` e `shots/index-caso-projecao-nm-1440-escuro.png`. |
| S1 (coluna "Do crescimento" some em "previsão não medida") | Fica, com a hachura "não medido" nas linhas e no total; a frase diz "e o crescimento ainda não foi medido". A coluna só some em zero medido (a frase explica). |
| S2 ("0 exportações" no erro ao ler é um "não sei" posando de zero) | No erro vira "não medido" com a frase "As exportações também vêm do banco, que não respondeu...". Nos outros estados o zero continua zero medido. |
| S3 ("60% do banco" lido como 60% do limite) | Frase "O Observatório ocupa 60% do que o banco do site ocupa" e coluna "Do que está ocupado". Dúvida 14 abaixo. |
| S4 (4% repetido quatro vezes em "acima") | A frase fica "Banco do site acima do limite: 104% do limite."; o "Passou 4%" mora na célula e na barra. |
| S5 (o ⓘ prometia o NAS) | "A ideia é, quando existir, enviar ao chegar a um percentual do limite, por botão ou agendado." |
| S6 e S7 (data e frase de "ainda sem medida") | "Passa a existir em 27/10, quando houver 14 dias de leitura." e "Antes disso não há dado." |
| S8 (zona vermelha cheia da régua em estado calmo) | Só listras verticais (sem preenchimento) quando a previsão não é vermelha; cheia só em "enche em N dias". |
| S9 e S10 | Mantidos: estética (faixa vazia a 1440, "exemplo" sozinho a 390, âmbar e laranja parecidos no claro, herança dos tokens do lote 1). |

### Tabela de coerência por estado (refeita depois das edições; lida do DOM por script, 1440 e 390, painel aberto)

O script confere em cada estado, nas duas larguras: o mesmo inteiro na pastilha, na frase, no rótulo e no `aria-label` da barra; "Ainda livre" = 100 menos o inteiro (acima: o inteiro menos 100); as partes do banco e do crescimento somam 100; Observatório = concorrentes + seu canal; os dias da pastilha, da frase e da régua são os mesmos; o `aria-label` da régua em "acima" diz "já passou"; nenhuma rolagem horizontal; e nenhuma ocorrência de "MB" nem de "lote" fora do ⓘ, em texto, `aria-label`, `title` e `alt`. Resultado: **24 conferências (12 estados x 2 larguras), 0 falhas.** Mais as 60 capturas (1440 e 390 x escuro e claro) com `medidas.json` limpo: rolagem 0, nenhum texto abaixo de 12 px, nenhum alvo abaixo de 44 px a 390. Todos os números saem de `bl.js` (MB de cada parte e quanto cada uma cresceu; o resto é derivado):

| Estado | % do limite (pastilha = frase = barra) | Do que está ocupado: concorrentes + seu canal + resto | Do crescimento | Dias, data |
|---|---|---|---|---|
| verde | 43 | 19 + 41 + 40 = 100 (Observatório 60) | 43 + 31 + 26 = 100 (74) | 1187 d, jan/2030 |
| amarelo | 72 | 31 + 37 + 32 = 100 (68) | 43 + 34 + 23 = 100 (77) | 700 d, set/2028 |
| vermelho por tamanho | 88 | 39 + 32 + 29 = 100 (71) | 55 + 25 + 20 = 100 (80) | 200 d, mai/2027 |
| vermelho por previsão | 78 | 40 + 31 + 29 = 100 (71) | 64 + 23 + 13 = 100 (87) | 80 d, 01/01/2027 (hoje + 80) |
| acima | 104 (passou 4) | 39 + 31 + 30 = 100 (70) | 55 + 25 + 20 = 100 (80) | "já passou" |
| zero medido | 43 | 19 + 41 + 40 = 100 (60) | coluna não existe; a frase explica | "sem data" |
| previsão não medida | 43 | 19 + 41 + 40 = 100 (60) | "não medido" (hachura) | faltam 8 dias, 21/10 |
| exportações a confirmar | 43 | igual ao verde | igual ao verde | igual ao verde |
| sem leitura hoje, erro, ainda sem medida | sem percentual (hachura); sem leitura hoje mostra a última leitura (43%) | não medido | não medido | não medido |
| só leitura | nada desenhado (conferido: nenhuma pastilha) | | | |

### Dúvidas novas para o dono (padrão adotado em cada uma)

14. **"Quem ocupa" fala "do que o banco ocupa", não "do limite".** O Observatório é 60% do que está ocupado hoje, o que equivale a 26% do limite. Adotei "do que está ocupado" para não competir com o "43% do limite" da pastilha. A alternativa é dividir o limite (Observatório 26% + resto 17% + livre 57%); é mudança de cálculo, não de desenho.
15. **Os MB aparecem no botão de informação ou em lugar nenhum?** Padrão adotado: só no botão de informação (tamanho, crescimento, as três partes e a conta da previsão). Tirar de lá são duas linhas.
16. **O lugar reservado do NAS fica ou sai?** Padrão adotado: fica, uma linha pontilhada "ainda não existe", sem botão, só com o painel aberto. Sai apagando a constante `NAS`. Se ficar: em que percentual dispara (sugestão: 85%) e se é botão, agendamento ou os dois.
17. **No erro ao ler o banco, as exportações viram "não medido".** Padrão adotado, porque a consulta vem do mesmo banco; se for outra consulta que respondeu, o zero volta.
18. **"Exportação" no lugar de "lote"** continua o padrão até o dono dizer outra palavra.

### O que não foi verificado nesta rodada
Leitor de tela (li os `aria-label` no DOM, não ouvi), Safari e Opera, toque em aparelho real, fontes da web (a captura as bloqueia), contraste das texturas novas medido por script (olhei em claro e escuro; são `rgba` preto ou branco de 42 a 45% sobre as cores `--lado-*` já medidas) e uma nova rodada do `revisor-ux-senior` (a r4 apontou, esta rodada corrigiu; falta ele conferir). Abri 4 capturas; as demais conferi por medida e por script.
