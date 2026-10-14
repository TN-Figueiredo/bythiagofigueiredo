# Revisão do Logan (UX) sobre o DESENHO da M4, rodada 1

14/10/2026. Revisão de fluxo, sem navegador (pedido do controlador): lidos `remover-canal/index.html`, `rc.js`, `NOTAS.md`; `18-v2.html`, `NOTAS-18-v2.md`, o diff de `bl2.js` contra `bl.js`; spec 04 L202-229, L271-293, L354; `CONVENCOES.md` do lote 2 (§1.8). Capturas olhadas: `index-e-d3-390-claro`, `index-e-d4a-alto-390-claro`, `index-e-d5-390-claro`, `index-e-d7-quem-ed-n-2-dt-depois-390-claro`, `index-r-r3-cap-ss-390-claro`, `18-v2-caso-v4-390-claro`, `18-v2-caso-v8-390-claro`.

## Resumo

| Tela | Pergunta de quem abre | Passos da tarefa principal | Veredito |
|---|---|---|---|
| Diálogo "Remover canal" | "Quanto eu perco, e o arquivo vai junto?" | 3 (Remover canal…, ler, confirmar); 4 em D4 (digitar o nome); +1 no retorno com arquivo ("Entendi") | **ACORDO COM CONDIÇÕES** (volta para ajuste em dois textos: K1, K2) |
| 18-v2 | "O banco fica sem espaço antes do alívio chegar?" | 0 (pastilha) a 1 (abre o painel) | **ACORDO** (só sugestões e duas linhas para a Naksu) |

Condições da revisão do plano: C1 a C9 resolvidas no desenho. 11.2 parcial (o código de 8 caracteres do `sem_destino` não tem estado no plano M4: aceito fora deste mockup, desde que entre no quadro onde o `sem_destino` for desenhado). 11.1 aberta só na parte de documento (a linha de exceção ainda não está no `CONVENCOES.md` §1.8; não bloqueia mockup) e com um erro meu herdado pelo desenho (K1).

**As três fricções que mais custam ao conjunto agora:**
1. O retorno "Sim | Sim" manda "ver os comandos" sem caminho para eles e fala de "a página" sem dizer qual (K2). É a única data de ação da remoção.
2. D5 escreve "a parte no arquivo não foi lida": jargão proibido, e a frase foi proposta por mim no 11.3 (K1).
3. A 390 px, em D3, "Não dá para desfazer" fica abaixo da dobra com o rodapé fixo; dá para confirmar sem ter visto a frase (S1, sugestão, com linha para a Naksu).

## Decisões pedidas

**Retorno depois de remover: fica o toast persistente, neutro, com "Entendi". Retiro a faixa no topo.** Motivos: (a) em "Sim | Sim" o bloco "Canais removidos" existe por definição (spec 04 L225) e já carrega o prazo e o caminho para os comandos de forma durável; o retorno não precisa ser o portador permanente do prazo, só a primeira notícia dele; (b) toast com ação que não some sozinho é padrão conhecido (snackbar indefinido do Android, aviso do Gmail), enquanto uma faixa só para um dos três retornos criaria um segundo padrão para a mesma ação; (c) a 390 px o toast fica embaixo, onde o polegar já está (Fitts). Condição: K2.

**Régua de quatro etapas em miniatura no diálogo: fica para depois, não é condição.** Motivos: em "Não | Não" e "Não | Sim" três das quatro etapas não existem ainda (o comando não chegou), e a régua mostraria três pontilhados sem data, mais altura numa caixa cujo rodapé fixo já disputa espaço a 390 px; os quatro itens de "O que acontece" já dizem o mesmo em texto lido em uma passada. A forma é aprendida no bloco "Canais removidos", onde ela tem dado. Reabrir quando o comando de limpeza existir ("Sim | Sim" vira o caso normal) e o mesmo componente puder ser reaproveitado.

---

## Mockup 1: diálogo "Remover canal" (ACORDO COM CONDIÇÕES)

### 1. O que a proposta acerta (preservar)
- Padrão em D3 "Não | Não"; rodapé de botões fixo; a 390 px o botão e "Cancelar" ficam à vista sem rolar (captura `d3-390-claro`); foco inicial em "Cancelar".
- D7 virou título + uma frase + "Fechar": a tarefa caiu de ler cinco linhas e três parágrafos para ler uma frase. D9 separa "a conexão caiu" de "o servidor recusou".
- D4: nome em caixa própria, campo logo acima dos botões, comparação tolerante a acento, emoji, caixa e espaço; status dizendo o que falta.
- O retorno deixou de ser toast verde que afirma "foram apagados"; cada combinação diz só o que é verdade nela, sem prometer data que não existe.

### 2. A fricção, cirúrgica

**K1. D5 e D5+D8: "a parte no arquivo não foi lida"** (corrige)
- Falha: usa "lida" sem data, a forma proibida pelo §1.8 (só "lido em dd/mm" é exceção, conforme a minha 11.1). A frase veio da minha própria 11.3; o erro é meu, e o desenho o copiou fielmente.
- Evidência: `rc.js` L79; captura `d5-390-claro`, apoio das duas primeiras linhas.
- Custo: o teste de vocabulário do item 38 reprova a tela; e "lida" é a palavra do sistema, não da pessoa.

**K2. R3 "Sim | Sim": o próximo passo não tem caminho, e "a página" não diz qual** (corrige)
- Falha: "(ver os comandos)" é texto, não link; "a página só avisa quando você a abre" não diz que página.
- Evidência: `rc.js`, função `retorno()`, ramo `CAP === 'ss'`; captura `r3-cap-ss-390-claro`.
- Custo: a única tarefa com prazo que a remoção gera pede que o dono procure sozinho onde estão os comandos, no celular, entre gravações; ao tocar em "Entendi" o caminho some.

**S1. D3/D4 a 390 px: "Não dá para desfazer" abaixo da dobra** (sugestão)
- O conteúdo rola por dentro e nada indica que continua (a lista "O que acontece" termina rente ao rodapé). Dá para confirmar sem ver a frase. O rótulo "Remover e apagar do arquivo" já carrega o essencial, por isso não bloqueia. **Para a Naksu:** sombra ou borda no topo do rodapé fixo enquanto houver conteúdo abaixo.

**S2. D7: o título "Remover <nome>?" pergunta algo que a caixa não deixa responder** (sugestão)
- Só há "Fechar". Título proposto: "Não dá para remover <nome> agora". Custo atual pequeno: um tropeço de leitura.

**S3. R3 "Não | Não" e "Não | Sim": persistente sem nada a fazer** (sugestão)
- A frase diz "até lá não há nada a fazer" e mesmo assim pede um toque em "Entendi". Eu tinha proposto temporizador (o dobro do de hoje). Aceito o persistente nos três se o dono preferir uma regra só; registro o custo: um toque a mais em toda remoção até o comando chegar.

**S4. D5: "Nada foi removido." antes de qualquer clique** (sugestão)
- É frase do spec; dentro do diálogo, antes de confirmar, ela responde a uma pergunta que ninguém fez. Levar ao dono no próximo fecho do spec: "Não foi possível ler o arquivo deste canal."

**S5. Marca "canais removidos" cinza até o dia 30, e o prazo prometido no R3 é o dia 30** (sugestão, decisão do spec, não do desenho)
- O desenho segue o spec 04 L221/L354 à risca. Mas o primeiro aviso de cor chega no dia em que o prazo já venceu; não há sinal de "vence em breve". Proposta para o dono: âmbar aos 23 dias ("vence em 7 dias"), vermelho aos 30; ou manter 30/60 e trocar no R3 "até dd/mm (30 dias)" por um prazo que combine com a cor.

### 3. A solução acionável
- **K1:** em `quatro()`, o apoio de D5 passa a "a parte no arquivo ficou fora da conta" (as duas linhas). O rótulo "D5 Arquivo não lido" da barra de estados é fora da tela e pode ficar. Vale também corrigir a minha 11.3 na revisão do plano (eu anoto lá na próxima rodada, se o controlador pedir).
- **K2:** no ramo "Sim | Sim" de `retorno()`: "ver os comandos" vira link para o bloco "Canais removidos" da página do Arquivo (âncora no bloco, não no topo da página), e a última frase vira "Ponha um lembrete no celular: a página do Arquivo só avisa quando você a abre." Nada mais muda no toast.

---

## Mockup 2: 18-v2 (ACORDO)

### 1. O que a proposta acerta (preservar)
- A linha da cópia nunca mostra o visto sem dado: antes da primeira (pontilhado com a data 28/11), atrasada (triângulo/octógono com dias e porta), não medida (hachura).
- V8: frase-resumo + "O que fazer:" em três itens; a ação é um item, não meio de parágrafo (captura `v8-390-claro`).
- Régua do V4 com as duas datas e "20 dias" de aperto; segundo marcador da barra com texto visível. O mês fora das telas é sub-linha de Concorrentes e a primeira linha de "O que libera espaço".
- Chips do automático e dos removidos ao lado da pastilha, não dentro: a pastilha continua respondendo só "quanto falta de banco".

### 2. A fricção, cirúrgica
- Nenhum achado de fluxo que bloqueie ou corrija.
- **S6** (sugestão): "Volta quando o banco puder ser lido." e "não foi lido por inteiro" (`bl2.js` L276, L297) usam "lido" solto, mas vêm do 18 aprovado (`bl.js`), não desta versão. Trocar no próximo lote ("Volta quando o banco responder.", "não respondeu por inteiro").
- **Para a Naksu** (uma linha cada, sem medição minha): V4 a 390 px, o rótulo vermelho "chega a 89% antes da próxima saída" sobrepõe a legenda "70% a 85%: enchendo"; e o rótulo "novembro pronto em 16/05" encosta na borda esquerda da régua (V5 já está nas notas como apertado).

### 3. A solução acionável
- Sem condição. As sugestões vão ao roteiro de melhorias.

---

## O que eu NÃO verifiquei
- Nada em navegador: Tab, Esc, foco de volta, o liberar do botão no D4 digitando, e o "Tentar de novo" foram lidos no código, não executados.
- Só sete capturas abertas; os demais estados do 18-v2 (V0, V1a, V1n, V2, V3, V5, V6, V7, V9 a V12n) foram julgados pelo texto gerado em `bl2.js`.
- Leitor de tela, rede lenta de verdade e aparelho real.
