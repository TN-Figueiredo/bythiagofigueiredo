# Revisão do Logan (UX) sobre o mockup 19, peças 1 a 3 (rodada 1)

14/10/2026. Revisão de fluxo, sem navegador (ordem do controlador). Lidos: `index.js`, `m19.js` (régua), `series.js` (até P1-2 e a função de comparação), `arq-dados.js` (trechos), `arquivo.js` inteiro, `NOTAS.md`, `REVISAO-LOGAN-PLANO.md`; spec 04 L22, L150, L154, L225, L241; spec 02 L160-184; `bl2.js` do 18-v2 L310-334. Capturas olhadas: `arquivo-1440-claro`, `arquivo-390-claro`, `arquivo-caso-magro-390-claro`, `arquivo-perfil-le-390-claro`, `series-1440-claro`, `series-390-claro`.

## Resumo

| Página | Pergunta de quem abre | Passos da tarefa principal | Veredito |
|---|---|---|---|
| `index.html` (casca) | "O que muda, onde está o desenho e o que falta?" | 1 (lê a tabela) | **ACORDO** |
| `series.html` (peça 1) | "Este número está completo ou falta um pedaço que saiu do banco?" | 0 (lê junto do número) | **ACORDO COM CONDIÇÕES** (S1 a S3) |
| `arquivo.html` (peças 2 e 3) | "Algum mês precisa de mim, e quando o banco ganha espaço?" | 0 (frase-resumo); tirar: 2 cliques; liberar: 2 cliques; trazer de volta: 1 | **ACORDO COM CONDIÇÕES** (A1 a A8) |

Nenhum achado bloqueia. Todos os **corrige** têm de estar feitos antes de ir ao dono.

**As três fricções que mais custam ao conjunto:**
1. A linha que precisa do dono (novembro de 2027, "conferir o B2") não tem ação nenhuma, enquanto a página põe três botões pretos "Tirar … do banco online" nas linhas que não precisam dele (A1).
2. Na régua do canal removido a 390 px, o rótulo curto "NAS" com visto quer dizer **apagado** do NAS; na régua do mês, logo abaixo, "No NAS" com visto quer dizer **está** no NAS. Lido ao contrário (A3).
3. Perfil "edita" lê "precisa de você" e "pede um comando seu" para ações que não pode fazer; e ninguém capturou esse perfil (A4).

---

## 1. Minhas condições do plano que tocam o 19 e as peças 1 a 3

| Condição | Estado | Evidência |
|---|---|---|
| 11.1 vocabulário | resolvida | nota no índice; `CONVENCOES.md` §1.8 já tem a exceção (NOTAS). Ver A2 sobre "Teste". |
| 11.2 "Apagar do arquivo" com frase digitada | resolvida no desenho | quadros C-APAGAR e C-APAGAR-SD: nome em negrito selecionável, código em mono com `user-select:all`, rótulo do campo, status. O campo não está ligado no mockup (declarado). |
| 11.6 triângulo até 36 h, octógono depois | resolvida | quadros PC1/PC2; limite no ⓘ da legenda. |
| 11.7 mês fora das telas em primeiro | **resolvida nos dois lugares** | 19: em "Views por dia" (captura 1440), setembro de 2027 vem logo depois da linha de contorno, acima de "Pode sair", com "Liberar o espaço devolve cerca de 4% do banco". 18-v2: `bl2.js` L312, `libLinhas()` empurra `mesDest` antes de `prontos`, e `libera()` (V5) e a linha da cópia (V3) usam a mesma função. |
| 11.8 frase-resumo e ordem | resolvida na forma; falta o perfil (A4) e "hoje" (A6) | `RES` em `arquivo.js`: casa, dois, um, calmo em `--muted` sem caixa, não medido em hachura. |
| 11.9 "arquivo" com dois sentidos | resolvida onde o texto é novo | "a cópia de <mês> no NAS" nos textos novos. |

---

## 2. As decisões da frontend-design

**D-1. ⓘ de "Fechado. Cópia a partir de dd/mm": SEM ACORDO com o texto; acordo com o ⓘ.**
- O texto atual (`arquivo.js` L10): "O YouTube ainda corrige as contagens dos últimos dias de um mês." O spec não sustenta essa causa: a razão escrita é a dos comentários (02 L180 e L184: respostas lidas até 37 dias do vídeo; anulação da identidade aos 28) e, para as séries, só "margem para selar 28 dias" (02 L162-163), sem motivo. Frase que afirma mais do que o dado sustenta.
- Custo: o dono passa a acreditar que o número do YouTube muda depois de fechado, e pode desconfiar de qualquer mês recente nas outras telas.
- **Texto pronto** (só fatos do spec): "A cópia espera o mês parar de mudar: 28 dias depois de fechar (45 nos comentários, que recebem respostas até 37 dias depois do vídeo). Se o mês mudar depois da cópia, ele é copiado de novo." A causa dos 28 dias nas séries, se o Phil a der com fonte, entra depois. Severidade: **corrige**.

**D-2. "linhas" → "comandos" (04 L241): ACORDO, com uma divergência a levar ao fecho.**
- "linhas" é proibida e ambígua; "comandos que ele imprimir, um por vez" diz o que fazer.
- Mas a linha do canal (04 L225, `c1`) diz "na forja, **o arquivo que ele gravar**" e a lista "Ver os comandos" diz "**cole** na forja os comandos que ele **imprimir**". O dono lê na linha "rodar um arquivo" e, um clique depois, "colar comandos". Na rua, com o celular, ele não sabe qual dos dois fazer. Essa divergência já está no spec, não é do desenho.
- **Solução:** Yannis/Phil dizem o que `expurgar` produz (arquivo ou texto para colar); as duas frases passam a dizer a mesma coisa no fecho do spec. Até lá, o mockup marca a divergência na tabela de sincronia. Severidade: **corrige** (no spec, não no desenho).
- Na página, "Ver os comandos" da linha do canal abre um texto de mockup ("Os comandos são do plano da M5…", `arquivo.js` L273), não a lista do quadro C-COMANDOS. O dono testa na página e vê meta-texto. **Solução:** o botão da linha abre a lista C-COMANDOS ali mesmo, abaixo da linha. Severidade: **corrige**.

**D-3. "Recuperação" vira "Teste" a 390 px: SEM ACORDO.**
- Na mesma página existe o grupo "Dado de teste" com a marca "teste" na linha do mês fictício (captura 390: "Mês de teste (jan/2028) [teste]" e, na régua da mesma linha, a etapa "Teste"). A mesma palavra em dois sentidos na mesma linha. E "Teste" não é o nome da etapa em nenhuma frase: as frases dizem "Recuperação testada em dd/mm".
- **Solução:** rótulo curto "Recup." (com ponto; abreviação lida como a palavra da frase), `aria-label` com o nome inteiro, como hoje. **Para a Naksu:** largura de "Recup." a 12 px nas cinco colunas de 346 px. Se não couber, "Recup" sem ponto; nunca "Teste". Severidade: **corrige**.

**D-4. Quadro "Aprovado hoje" da peça 1, reconstruído: ACORDO COM CONDIÇÕES (S1 a S3 abaixo).** A reconstrução serve à pergunta do dono ("o que muda?"), mas o rótulo diz que é a tela aprovada, e três quadros mostram coisas que a tela aprovada não tem.

**D-5. Peças 4 e 8 como espaço tracejado "+ novo": ACORDO com o espaço, SEM ACORDO com o rótulo "+ novo".**
- "+ novo" é o rótulo universal de "criar" (YouTube Studio, Drive, Notion). No Opera, o dono vai clicar e nada acontece; ou lê que existe um botão de criar interruptor. Na captura 390 o tracejado com "+ novo" ocupa duas linhas no topo de cada cartão, antes da frase-resumo do cartão.
- **Solução:** sem "+". Texto do marcador: "Peça 4, desenhada à parte: o interruptor do automático fica aqui." e "Peça 8, desenhada à parte." Sem aparência de botão (sem chip com borda própria). Severidade: **corrige**.

---

## 3. Achados por página

### `index.html` (casca): ACORDO
**Acerta:** tabela de sincronia com o que muda, onde está o desenho e o estado de aprovação de cada tela de origem (o 21 "segurado" está dito); índice de estados com a coluna "carregando"; a nota da exceção de vocabulário. Preservar.
- Sugestão: acrescentar à tabela a linha da divergência D-2 (L225 contra L241), para o fecho do spec não a perder.

### `series.html` (peça 1): ACORDO COM CONDIÇÕES
**Acerta:** as três ausências no eixo (hachura, pontilhado antes da coleta, caixa "no arquivo") sem nunca interpolar; idades com a data do seu mês; P1-10 diz com honestidade "o mockup aprovado não distingue o trecho anterior à coleta"; perfil só lê com a frase no lugar da porta. Preservar.

**S1. O rótulo "Aprovado hoje" diz mais do que o quadro é (corrige).**
- Evidência: `series.js` L39; NOTAS, decisão 6: "minha reconstrução… não a tela inteira do 13 ou do 15".
- Custo: o dono aprova a diferença entre duas colunas achando que a da esquerda é a tela que ele já aprovou; diferença de reconstrução vira mudança aprovada sem ninguém ver.
- **Solução:** rótulo "Hoje (trecho reconstruído do 13 aprovado)" / "do 15", "do 20", "do 21, segurado", conforme o selo; o nome do mockup é link para o arquivo aprovado.

**S2. Números impossíveis na coluna "Aprovado hoje" de P1-2 (corrige).**
- Evidência: captura 1440, P1-2 à esquerda: "5 dias 11,2 mil" acima de "7 dias 9,8 mil"; "21 dias 2,9 mil" antes de "30 dias 31,5 mil". Views acumuladas caem com a idade. Origem: `idades(…, antes)` troca cada célula "arq" por um valor de uma lista circular (`series.js` L18).
- Custo: o dono, que lê esses números todo dia, para no quadro para entender a queda e desconfia do resto da comparação.
- **Solução:** valores crescentes coerentes com as células medidas do mesmo vídeo: 2 dias 2,9 mil; 3 dias 4,1 mil; 5 dias 6,0 mil; 14 dias 18,6 mil; 21 dias 25,3 mil (entre 9,8 mil e 31,5 mil).

**S3. P1-12 "Aprovado hoje" mostra o botão "Ver antigo", que ainda não existe (corrige).**
- Evidência: captura 1440, P1-12, coluna esquerda: só o botão "Ver antigo". A porta é desta fase (peça 6).
- Custo: a comparação inverte o sentido: parece que quem só lê **perde** um botão que tinha.
- **Solução:** coluna da esquerda com o gráfico sem caixa de arquivo, como a coluna esquerda de P1-4; a nota fica.
- Sugestão: P1-1 mostra 3,1 mil antes e 3,4 mil depois; a nota não diz por que a média muda. Acrescentar: "A média muda porque passa a contar só o que está online."

### `arquivo.html` (peças 2 e 3): ACORDO COM CONDIÇÕES
**Acerta:** a frase-resumo responde à pergunta no primeiro olhar e segue a ordem de 11.8; a única linha com contorno é a que precisa do dono; mês fora das telas logo abaixo dela (11.7); réguas pontilhadas para o que não aconteceu (nunca zero); "Nenhum mês no arquivo ainda" como zero medido com data; peça 3 com uma condição por linha e um símbolo cada, nunca botão cinza mudo; diálogo com foco em "Cancelar", Esc fecha e devolve o foco; liberar o espaço em dois passos com a data em que libera. Preservar.

**A1. A linha que precisa do dono não tem ação; as que não precisam têm botão preto (corrige).**
- Tela: página, caso cheio, administra. Evidência: captura 1440, novembro de 2027 (contorno âmbar) não tem botão nem porta; a frase diz o que falta ("A forja não confere desde 26/04/2028"), não como fazer. `m5a` tem ação vazia em `arq-dados.js`. No mesmo cartão e no anterior, "Tirar fevereiro de 2028 / outubro de 2027 / o mês de teste do banco online" são os três elementos mais escuros da página.
- Por que falha: Fitts e a pergunta da tela. A frase-resumo diz "1 mês precisa de você: conferir o B2"; o olho chega na linha e não tem para onde ir.
- Custo: o dono lê o que fazer e sai da página sem fazer; a conferência vence (o ⓘ de B2 dá a validade) e o mês trava.
- **Solução:** na linha `m5a` (e em toda linha com contorno), a ação "Ver o comando" (mesmo botão e mesmo nome de "Ver os comandos" do canal removido e de "Ver o comando" do relógio da forja), que abre abaixo da linha o passo de conferir o B2 no Mac. Sugestão: a frase-resumo da página vira link para essa linha ("ir para novembro de 2027").

**A2. Data contraditória no caso magro, cartão dos comentários (corrige).**
- Evidência: captura `arquivo-caso-magro-390-claro`: resumo do cartão "A cópia de outubro de 2026 começa em 15/12/2026"; a linha logo abaixo "Fechado. Cópia a partir de 28/11/2026". Origem: `tipos()`, caso magro, aplica a troca de data de séries também ao cartão de texto.
- Custo: duas datas para o mesmo evento no mesmo cartão; o dono não sabe quando conferir.
- **Solução:** na linha de outubro de 2026 do cartão dos comentários, "Fechado. Cópia a partir de 15/12/2026".

**A3. Rótulos curtos da régua do canal removido leem ao contrário a 390 px (corrige).**
- Evidência: captura 390, bloco "Canais removidos": "Pedida · NAS · B2 · Snapshots" (L4 em `arq-dados.js` L6). Mais abaixo, a régua do mês: "No NAS · No B2". Um visto em "NAS" no canal quer dizer apagado; em "No NAS" no mês, guardado.
- Custo: o dono conclui que o canal removido ainda está no NAS (ou o contrário) e roda o comando de novo, ou deixa de rodar.
- **Solução:** curtos "Pedida · Sem NAS · Sem B2 · Snapshots". **Para a Naksu:** largura de "Sem NAS" em quatro colunas a 346 px.

**A4. Perfil "edita": frases em segunda pessoa para o que ele não pode fazer, e sem captura (corrige).**
- Evidência: `resumoPagina()` e `blocoPadrao()` não olham o perfil: quem edita lê "1 mês precisa de você… e 1 canal removido pede um comando seu"; nas linhas, "Quem administra o site faz isto." repetido em cada linha com ação. `shots/` não tem nenhuma captura `perfil-ed`.
- Custo: o editor procura um botão que não existe para uma tarefa que não é dele.
- **Solução:** para quem edita, a frase-resumo diz "1 mês e 1 canal removido esperam quem administra o site."; o resumo de "Canais removidos" diz "1 espera um comando de quem administra"; a frase "Quem administra o site faz isto." sai das linhas e aparece uma vez, abaixo da frase-resumo. Capturar `?perfil=ed` a 390 e 1440.

**A5. Perfil "só lê": a aba "Arquivo" aparece e leva a meta-texto (corrige).**
- Evidência: captura `arquivo-perfil-le-390-claro`: aba "Arquivo" sublinhada; corpo "O Arquivo é de quem edita o site. Quem só lê vê, nas telas de gráficos, 'No arquivo desde mm/aaaa.' Sem a página, sem a porta 'Ver antigo', sem botões." Mistura texto de tela com nota de mockup; não há caminho de volta.
- **Solução:** no quadro de só lê, a barra de navegação sem a aba "Arquivo" (o padrão dos painéis: o que não é seu não aparece). Para quem chegar pelo endereço: "Esta página é de quem edita o site." e o link "Voltar para Canais". A explicação do mockup vai para a nota do quadro, fora da tela.

**A6. "Próxima saída possível: 03/05/2028" quando 03/05/2028 é hoje (corrige).**
- Evidência: frase-resumo do caso cheio; o cartão diz "Outubro de 2027 pode sair agora".
- Custo: o dono compara a data com o calendário para descobrir que é hoje; a mesma informação tem duas formas na mesma tela.
- **Solução:** quando a data for hoje, "Um mês já pode sair."; data só quando for futura.

**A7. Na página, "Ver o que sairia" não existe na linha "Pode sair" (corrige).**
- Evidência: `acoes('sair')` só gera "Tirar … do banco online"; a simulação só existe nos quadros T2/T3 (`botoesT`).
- Custo: a tarefa principal da peça 3 testada na página pula a simulação; o dono aprova um fluxo sem ela.
- **Solução:** a linha "Pode sair" usa os dois botões de T3 ("Tirar … do banco online" e "Ver o que sairia"), na mesma ordem.

**A8. Dois canais removidos com o mesmo nome na página (corrige).**
- Evidência: captura 1440, "Canais removidos": duas linhas "Viagem Lenta" em estados diferentes (`c1` e `c7`).
- Custo: o dono lê o mesmo canal pedindo comando e já terminado, e não sabe qual vale.
- **Solução:** a segunda linha com outro nome de exemplo (ex.: "Rota Andina").

**Sugestões (não bloqueiam):**
- A ordem fixa dos cartões põe "Tirar fevereiro de 2028" (hora em hora) antes da linha urgente de "Views por dia" a 390 px. Manter a ordem do spec (mesmo lugar em toda visita) e resolver pelo link da frase-resumo (A1).
- "Trazer de volta" não tem confirmação: aceito (desfaz sem perda), mas a linha nova (M10) precisa de um aviso em `role="status"` para o foco não cair no nada.
- Cada cartão repete o título no começo do resumo ("Views por dia: 8 meses online…"); se a frase for fixada do spec, fica.

---

## 4. O que eu NÃO verifiquei
- Nada aberto em navegador (ordem do controlador): Esc, foco de volta e ordem de tabulação lidos só no código (`abre()`), não percorridos.
- Perfil "edita" e o caso "hoje" da página do Arquivo: sem captura de "edita"; o caso "hoje" lido só no código.
- Se a coluna "Aprovado hoje" de P1-0 (células pontilhadas "chega em dd/mm") é o que o 13 aprovado mostra: não abri o 13.
- Leitor de tela, rede lenta, aparelho real, Opera.
- O que `expurgar` produz de fato (D-2): é do Yannis e do Phil.
