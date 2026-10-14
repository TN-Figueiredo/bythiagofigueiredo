# Revisão do Logan (UX): peça 7, o arquivo pendente na fila "Saíram do YouTube", rodada 1

Revisado: `peca7.html` + `peca7.js` + `peca7.css` (os 8 estados, abertos em 390 e 1440 px, tema claro, com `file://`; rolagem horizontal 0 e erros de script 0 em todos), bloco "Peça 7" de NOTAS.md, PLANO-DAS-TELAS §1 e §9, spec 04 §14.7 (L388-400) e a linha de L270. Capturas em `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/61d7ed7e-f76d-43f4-aaa5-0d29b6b7c07a/scratchpad/l7/`.

## Resumo

Uma tela, um veredito: **volta para ajuste**. Dois bloqueantes (B1, B2), seis correções, três sugestões. **Sem acordo ainda**; dou o acordo quando B1 e B2 estiverem corrigidos e C1 a C6 respondidos.

Três fricções que mais custam:
1. O comando do dono não é "um arquivo + uma linha curta": são dois comandos, um deles de ~70 caracteres, e falta o passo que leva o arquivo do Mac até a forja (B1).
2. A tela diz "pode esperar" e pinta de vermelho o mesmo item, e a fila de decisões que dá para fechar do celular fica abaixo do bloco que exige Mac e forja (B2, C1).
3. "Já rodei" fica ao lado de "Ver os comandos", sem ter passado pelos comandos, e faz o item vermelho sumir com um toque (C2).

Não consegui verificar: leitor de tela, rede lenta de verdade, aparelho real, e se a forja é alcançável de fora do país (isso é fato de infra, não de tela).

## O que a proposta acerta (preservar)

- A pergunta ("falta eu rodar algum comando?") está respondida na frase-resumo, com a idade do mais antigo, antes de qualquer número. A forma do ícone acompanha o item mais velho. Preservar.
- Barra de idade 0-60 com cortes em 30 e 60: lê-se de relance, e a cor nunca vai no texto.
- Os dois zeros bem separados: "Não foi possível ler se há cópia no arquivo" em hachura (nm) e a caixa do zero medido. "Isto não quer dizer que não há cópia" é a frase certa.
- "Marcado como rodado" não some o item sem dizer que a verificação seguinte decide; "refutado" volta com frase própria.
- A fila de hoje fica intocada embaixo, e o "apagar" bloqueado usa a frase do spec, sem cor de erro e sem prazo.

## Pergunta e contagem de passos

Pergunta de quem abre: "Preciso rodar alguma coisa no Mac ou na forja, e é urgente?"
Resposta em 3 s: a primeira metade sim (frase-resumo a ~480 px no 390, dentro da primeira tela); a segunda metade não (ver B2).

Tarefa principal, um item de vídeo, do começo ao fim, como está desenhado: 3 tempos (copiar, conferir o B2, apagar). Cada tempo: abrir "Ver os comandos" (1 toque), selecionar e copiar o comando longo do Mac (sem botão de copiar), rodar, achar o arquivo que ele gravou, levá-lo à forja (passo que a tela não diz), rodar o `bash`, voltar à página, "Já rodei" (1 toque), esperar até 24 h. São cerca de 7 a 8 ações por tempo, 3 tempos, 3 idas e voltas separadas por até 24 h: perto de 22 ações e três dias de calendário para um item. Com a regra do dono (um arquivo + uma linha), cada tempo cai para 3 ações: abrir, rodar a linha, marcar.

---

## Achados

### B1. O comando do dono viola a lei: dois comandos, um longo, e um passo faltando (bloqueia)
- **Tela e estado:** `comandos-1`, `comandos-1b`, `comandos-2` (e o `Ver os comandos` de toda linha).
- **O que falha:** o passo 1 manda colar `npx tsx scripts/obs-arquivo.ts recopiar --mes 2027-09` (e variantes), o passo 2 manda rodar `bash recopiar-2027-09.sh` "na forja". São dois comandos, o primeiro com 4 argumentos. A lei é "um arquivo + uma linha curta que o roda, nada para colar além disso". Pior: o arquivo gravado no Mac chega à forja como? A tela não diz; o dono teria de saber `scp` (ou colar o conteúdo), e a escrita na forja é do dono, sem exceção (CLAUDE.md).
- **Por quê:** lei do dono; Hick (duas decisões onde cabe uma); cenário real: no celular, ou num café na Ásia, com o Mac aberto uma vez.
- **Evidência:** `peca7.js` L53-55, L60-62, L67-69; capturas `comandos-1b-390`, `comandos-2-1440`.
- **Custo:** ele cola errado o mês, ou roda o `.sh` do mês errado (há três nomes parecidos na tela), ou desiste na primeira vez e a lista vira o vermelho de 60 dias que o próprio plano quer evitar.
- **Solução:**
  1. Uma única linha por ação, **sem argumento e sem nome de mês**, a mesma para todos os itens do tipo. Texto na tela, em um bloco `<code>` com botão "Copiar linha": `npm run obs:arquivo` (nome final é do Yannis; o que importa é: curto, fixo, sem parâmetro). O script descobre sozinho o que está pendente (o site já sabe, é o que gera a fila) e conduz as três ações do tempo atual.
  2. Esse comando faz o trabalho inteiro do lado do Mac: grava o arquivo de comandos **e** o entrega à forja pelo caminho que o dono já usa (a linha que ele roda é a que faz o `ssh forja 'bash -s' < arquivo`, por exemplo), ou imprime, no fim, a linha exata a rodar. Se o Yannis disser que o agente não pode fazer esse envio (escrita na forja é do dono), o comando é o que o dono roda e a escrita é dele: continua sendo uma linha só. Se a entrega não pode ser feita por uma linha, o painel mostra **duas** linhas curtas, numeradas, e diz onde fica o arquivo ("na pasta tal do Mac"); nunca "o arquivo que ele gravou".
  3. Painel "Ver os comandos" passa de 3 passos para 2: "1. No Mac, rode: [linha] [Copiar]. 2. Espere: a página confirma sozinha em até 24 horas." O painel não repete o texto "Rodar de novo é sempre seguro" por tempo: uma vez, no ⓘ.
  4. Os três tempos usam a **mesma linha** (o comando decide o que fazer pela situação). Assim a tela não troca de comando entre tempos e o dono nunca erra o tempo. Isto muda o painel dos tempos 1b e 2 para só o título e a régua, sem texto de comando novo.
- **Pendente de dono do dado (Yannis, spec 11.3):** confirmar que um comando sem argumento é viável e que ele cobre os "três arquivos do mês" sem o dono listar nada. Se não for, a regra "uma linha" vira "uma linha por item, com o mês já embutido na linha que a tela monta", e o botão Copiar passa a ser obrigatório.

### B2. "Pode esperar" e vermelho dizem coisas opostas, e a tela não responde "de longe ou espera?" (bloqueia)
- **Tela e estado:** `cheia` e todos os com item; NOTAS decisão 4.
- **O que falha:** cada item repete "Pode esperar até você voltar" (3 vezes) e, ao mesmo tempo, o item de 63 dias leva octógono, borda vermelha e fundo vermelho claro, e o resumo abre com o mesmo octógono. O dono lê: "é grave" e "não é grave" no mesmo cartão. Além disso "continuam no arquivo" afirma que esperar é inofensivo, e o dado não sustenta isso (o spec não diz que é; são registros de vídeo apagado, e o motivo de rodar é justamente tirá-los de lá).
- **Por quê:** lei de Jakob/consistência de sinal (vermelho = pare e aja); o dono fora em jan/2027 precisa de uma resposta única: "faço de longe", "espero" ou "não depende de mim".
- **Evidência:** `peca7.js` L88-89 (a frase `pode`); `cheia-390` (item vermelho com "Pode esperar" logo abaixo).
- **Custo:** ele ou ignora o vermelho (aprende que vermelho aqui não vale) ou larga a viagem para rodar algo que podia esperar. Nos dois casos o sinal perde valor para as outras peças.
- **Solução:**
  1. Tirar "Pode esperar até você voltar" de cada item.
  2. Acrescentar **uma** frase ao resumo, depois do número, que resolve a decisão: "Nada disso se perde se esperar; só o espaço e o prazo do arquivo ficam parados." (a frase exata depende do que o Yannis/Phil confirmarem do custo real de esperar; **se esperar tem custo, a frase diz qual**, em vez de "pode esperar".)
  3. Âmbar e vermelho ficam (são do spec L399-400), mas a frase do item vermelho deve dizer o que o 60 dias significa, em termos do que ele faz: "Passou de 60 dias. Quando voltar, rode a linha abaixo." Sem isso, a cor não tem ação.
  4. Se o Yannis confirmar que o comando pode ser rodado de longe (tailnet), a mesma frase do resumo ganha: "Dá para rodar de qualquer lugar." Se não puder, não afirmar nada: "precisa do Mac e da forja ligados".

### C1. As decisões que o celular resolve ficam abaixo do bloco que exige Mac (corrige)
- **Tela:** `cheia` em 390.
- **O que falha:** a ordem é resumo, "Esperam você rodar os comandos (3)" (alto, ~900 px de cartões), e só então "Esperam a sua resposta (2)". Os dois itens de resposta são um toque cada ("Manter para análise" ou "Apagar…"), feitos de qualquer lugar; os três de cima exigem Mac, forja e terminal. A tela põe o que ele não pode fazer de longe na frente do que pode.
- **Por quê:** Fitts e cenário hostil (celular, rua, pressa): o que cabe no polegar vem primeiro.
- **Custo:** rolar ~900 px a 390 para chegar à única coisa executável no celular; em viagem, o mais comum é ler "não posso agora" e fechar sem ter decidido os dois itens de resposta.
- **Solução:** inverter: resumo → "Esperam a sua resposta (N)" → "Esperam você rodar os comandos (N)". O resumo ganha um chip por grupo ("2 para decidir agora · 3 para o Mac") se a ordem inversa for rejeitada pelo spec. A fila de hoje sobe sem mudar nada dentro dela.

### C2. "Já rodei" fica ao lado de "Ver os comandos" e apaga o vermelho com um toque (corrige)
- **Tela:** todo item.
- **O que falha:** os dois botões têm o mesmo peso, lado a lado, em 390 px (alvo grande, quase impossível errar de lado, mas fácil errar de ordem). "Já rodei" troca o item por "Marcado como rodado" sem desfazer; o item de 63 dias some da fila e o resumo cai (3 itens para 2) até a verificação seguinte, de até 24 h.
- **Por quê:** ação irreversível perto da comum (Fitts); o dono pode tocar "Já rodei" **antes** de ler os comandos, por hábito de "marcar como feito".
- **Custo:** ele acredita ter fechado o item, o sinal vermelho desaparece e só volta se a verificação refutar (e a peça diz que refuta, mas só no dia seguinte).
- **Solução:** "Já rodei" sai da linha de ações e entra **dentro do painel aberto**, como último passo, depois de "Espere…": "3. Rodou a linha? [Já rodei]". Fechado o painel, o cartão tem **um** botão, "Ver os comandos". Dentro do "Marcado como rodado", acrescentar "[Desfazer]" por 1 toque e dizer o que vem: "Volte em até 24 horas: se houver mais um passo, ele aparece aqui."

### C3. No tempo 1b a tela não diz por que cabe ao dono conferir o B2 (corrige)
- **Tela:** `comandos-1b`.
- **O que falha:** o spec (10.9) faz a **forja** conferir o B2; o dono só entra quando a conferência da forja falhou. A régua e o texto dizem "Falta conferir o B2 de novo (veja o comando acima)" sem dizer **que a forja não conseguiu, nem por quê**.
- **Por quê:** o dono não sabe se é rotina ou falha; texto que afirma menos do que o dado sustenta (aqui, afirma "falta" sem a origem).
- **Custo:** ele roda o comando sem saber o que corrige e, se falhar de novo, não sabe o que dizer ao Cowork.
- **Solução:** título do painel 1b: "A forja não conseguiu conferir o B2 em dd/mm." (data do último fracasso; se a razão não está no dado, só isso). Se a causa existe no registro (ex.: "o B2 não respondeu"), vai na mesma frase.

### C4. A régua mistura o que o dono faz com o que roda sozinho (corrige)
- **Tela:** `comandos-1`, `comandos-1b`, `comandos-2`.
- **O que falha:** as quatro etapas têm o mesmo peso. "Verificar no NAS" e "Conferir o B2" são automáticas; só "Copiar a versão nova" e "Apagar as antigas" são do dono. Hoje as quatro parecem tarefas.
- **Custo:** ele procura o que fazer em "Verificar no NAS" e desconfia que está travado.
- **Solução:** sob cada rótulo, uma palavra: "você" ou "sozinho". Mesmo traço, nenhuma cor nova.

### C5. Texto do estado "vazia" afirma mais do que o dado sustenta (corrige)
- **Tela:** `vazia`.
- **O que falha:** "Tudo o que foi apagado já saiu do arquivo, ou nunca esteve nele." O dado é "nenhum item espera comando"; não é "tudo saiu do arquivo" (itens marcados com "Já rodei" e ainda não verificados não estão nem aqui nem fora).
- **Custo:** ele conclui que o arquivo está limpo e para de olhar.
- **Solução:** "**Nenhum item espera você rodar comandos.** Última conferência do arquivo: hoje, às 07:10." Cortar a segunda frase.

### C6. A frase de "refutado" cita o canal, e a refutação é do vídeo (corrige)
- **Tela:** `refutado`.
- **O que falha:** "ainda encontra os registros de Nômade Raiz no NAS", mas os dois itens de vídeo são do mesmo canal. A frase do spec usa `<canal>`, e é a que está certa para o spec, mas com dois itens do mesmo canal fica ambígua.
- **Solução:** pedir ao Yannis o texto do vídeo no registro ("os registros de «Os 5 piores erros em Bangkok» ainda estão no NAS"); se o spec não tem, manter a do spec e acrescentar o título abaixo do canal na linha do cartão (já existe, `h3`). Dizer também **desde quando conta a idade** depois do refutado (continua 34 ou recomeça?).

### S1. A frase do "apagar" bloqueado repete idêntica em cada linha (sugestão)
Duas linhas de resposta, duas caixas iguais com "Abrir o Arquivo" duas vezes (`bloqueado-390`). A frase vale para o grupo. Uma caixa acima das linhas, as duas linhas só com "Manter para análise". Corta ~170 px no celular. Não muda o texto do spec.

### S2. Estado "não medido" some a lista (sugestão)
Em `nm` os três itens desaparecem e fica só a hachura. É correto como "não medido", mas o dono que tinha um item de 63 dias vê a lista sumir. Sugiro mostrar, se o site tiver, "Última leitura em dd/mm: 3 itens, o mais antigo há N dias" abaixo da hachura. Só se o dado existe; senão, como está.

### S3. Quem vê o quê (sugestão, não verifiquei)
O spec restringe o link do Arquivo a quem administra; a peça mostra os comandos e "Já rodei" sem declarar perfil. Declarar que quem só edita vê o resumo e a idade, sem os comandos. Fora do que consegui verificar numa maquete estática.

## Decisões do desenhista (NOTAS), veredito

1. **Frase-resumo.** Aprovada na forma; muda por B2 (acrescentar a frase que resolve esperar/agir).
2. **Barra de idade 0-60.** Aprovada. Âmbar a partir de 30 e vermelho a partir de 60 são do spec; a cor só no contorno e no preenchimento, texto normal: correto.
3. **Régua de quatro etapas e pontilhado de "falta verificar".** Aprovada com C4. Os comandos de exemplo (`recopiar`, `conferir-b2`, `apagar-antigas`) **não aprovados**: B1.
4. **"Pode esperar até você voltar".** **Reprovada** como está (B2). Não afirmar que dá para rodar de longe foi o acerto; falta dizer o que esperar custa, uma vez.
5. **"Já rodei" sem passo extra de confirmação.** Aprovada a ausência de confirmação (a verificação seguinte é a rede de segurança) **desde que** o botão mude de lugar e ganhe "Desfazer" (C2).
6. **"Apagar" bloqueado.** Aprovada, com S1.
7. **Não medido e zero medido.** Aprovada no não medido; o zero medido volta por C5.

## Para a Naksu (uma linha cada, sem medir)
- Alvos dos botões do painel e do "Copiar linha" a 390 px (44 px); `code` longo quebra, conferir sem rolagem horizontal.
- Âmbar contra fundo `warn-subtle` no cartão de 34 dias e o texto `há 34 dias`: contraste é dela.

## Veredito da tela
**Volta para ajuste.** Bloqueantes: B1 (comando do dono) e B2 (sinal contra "pode esperar"). Corrige: C1 a C6. Sugestões: S1 a S3. Pendências de outros: o Yannis responde se um comando sem argumento é viável e se a forja é alcançável de fora (B1, B2); o Phil responde se esperar tem custo real de dado (B2).
