# Revisão Logan (UX), peça 6 "Ver antigo", rodada 1 (14/10/2026)

Verificado: Playwright sobre `file://`, 390 e 1440 px, `?e=pagina&inicio=antes` (pedir, esperar, pronto), `todos-erro`, `todos-antes`, `todos-video`, `perfil=le`. Rolagem horizontal 0, erros de script 0. Capturas em arquivo temporário (scratchpad da sessão). NÃO verifiquei: leitor de tela, rede lenta real, aparelho real, sol na tela.

**Pergunta do dono:** "Consigo ver o passado deste canal, e vai demorar?"
**Passos da tarefa principal (390 px, abertura `?e=pagina&inicio=antes`):** Ver antigo (painel já aberto, abaixo da dobra: o "Pedir" fica em y=958 com tela de 844, 1 rolagem) -> escolher período (opcional) -> Pedir = 2 toques + 1 rolagem com 12 meses, 3 toques com outro período. Cancelar: 1 toque. Ao abrir no estado "pronto" (padrão do mockup), o botão "Ver antigo" funciona como liga/desliga e o painel já está aberto: quem toca nele fecha o que acabou de pedir ver.

## Veredito: **volta para ajuste** (3 bloqueantes, 4 correções, 4 sugestões). Acordo: ainda não.

## O que acerta (preservar)
Painel encaixado embaixo do gráfico, sem página nova: caminho curto. Frase "Vai ler os 12 meses...: 7 online, 5 no arquivo" e o aviso "não é na hora" antes do botão. Estados de espera próprios ("Aguardando a casa", "Lendo: 9 de 12") em vez de esqueleto. Mês que falta com forma do motivo, nunca zero; julho como zero medido; "parcial" marcado. Os 15 estados do spec estão todos presentes, frase por frase. Resultado fica 30 dias e a tela diz isso.

## Achados

### B1. Frase de "desde" contraria a decisão do dono na peça 1 (bloqueia)
Onde: gráfico da página do canal, todos os estados, e perfil só lê. O rótulo dentro do eixo ("no arquivo desde 08/2027") e a legenda logo abaixo ("No arquivo desde 08/2027.") dizem a mesma coisa duas vezes, e as duas na forma que o dono já recusou. Eixo logo acima mostra 25/08/2027 a 01/10/2027: o dono lê um trecho e a frase fala de um começo aberto. Custo: o dono entende que tudo "desde 08/2027" está no arquivo e pede 12 meses esperando ver dado de 2028 vindo de lá. Em `perfil=le` o leitor vê a mesma frase sem botão.
Solução: rótulo no eixo e legenda viram **"25/08 a 30/09/2027 no arquivo"** (uma vez só; a legenda sai, fica o rótulo e o botão). Mesma frase em `perfil=le`: "25/08 a 30/09/2027 no arquivo." sem botão. O botão continua "Ver antigo" com a linha de apoio "Ver o que está no arquivo" (só uma vez: hoje a linha de apoio aparece também no cabeçalho do painel). Dentro do painel, onde a frase cita o recorte do pedido, o "desde" só é aceitável como "desde 03/2024" em "todos os 50 meses (desde 03/2024)", que é o início da coleta e não o do arquivo; trocar por "todos os 50 meses (a coleta começou em 03/2024)" para não reintroduzir o "desde" do arquivo.

### B2. Pedido que sempre falha: "Tudo" leva a um beco só depois de pedir (bloqueia)
Onde: estado "antes de pedir", botão "Tudo". A frase diz "Vai ler todos os 50 meses", o botão Pedir está ativo, e só depois do toque vem "passa do tamanho que o site guarda". 1 toque e uma rolagem desperdiçados num caminho que o site já sabe que falha; com internet cara, é um pedido pago por nada. A frase de erro ainda manda "peça menos canais" numa tela de um canal só.
Solução: o site sabe o limite antes. Quando o período passa dele, a frase em cima do botão diz "Tudo passa do que o site guarda (50 meses). Escolha até 36 meses." e o Pedir fica desligado com esse motivo (ou o "Tudo" já vem com essa nota). Manter o quadro "pediu demais" para o caso em que o limite só é conhecido pelo servidor. Texto do erro: "O período pedido passa do tamanho que o site guarda. Peça menos meses." (tirar "canais" onde o pedido é de um canal; o spec fala em canais porque a peça pode ter vários, aqui não).

### B3. Acompanhamento do pedido perde o foco e pode perder o toque (bloqueia)
Onde: "Esperando", andamento. Medido: foquei "Cancelar pedido", esperei 1,5 s e `document.activeElement` virou `BODY`. O painel inteiro é reescrito a cada tick (700 ms no mockup) dentro de `aria-live`: o botão é destruído e recriado. Efeitos: quem usa teclado perde o foco a cada atualização; um toque que cai entre o pressionar e o soltar numa atualização é descartado (o clique só vale se o elemento for o mesmo), e Cancelar é a única saída da espera; leitor de tela repete o painel inteiro a cada tick. O dono, com sol e dedo grosso, toca duas vezes.
Solução: atualizar só o texto "Lendo: N de M", a porcentagem e a largura da barra; o botão e o `aria-live` ficam no lugar. Anunciar só mudança de estado (enviado, andando, pronto, erro), não cada mês. Ao chegar o resultado, levar o foco ao painel (hoje não vai).

### C1. "Já lidos: maio de 2027 a nenhum ainda." (corrige)
Medido com n=1 e n=0: a frase sai quebrada. Solução: com 0 lidos, omitir a linha ("Ainda lendo o primeiro mês."); com 1, "Já lido: maio de 2027."; com 2 ou mais, a faixa.

### C2. O período escolhido não vale no resultado (corrige)
Escolhi 24 meses, toquei Pedir: a espera diz "9 de 12" e o resultado diz "Veio tudo: 12 meses". O dono que segue o roteiro (item 1 do 19e) lê isso como defeito, e na vida real seria "pedi 24 e vieram 12 sem explicação". Solução no mockup: a espera e o resultado seguem o período escolhido (24: 24 linhas curtas, ou 12 visíveis com "e mais 12 meses" recolhido). Se o desenhista preferir manter 12 linhas por limite de mockup, a nota do quadro declara isso por escrito.

### C3. "Pode esperar: se você está fora de casa, peça de novo quando voltar." confunde duas casas (corrige)
O dono está fora do país em jan/2027. "Casa" no produto é a forja e o NAS; na frase, "fora de casa" passa a ser ele. Ele pode ler "se eu estou fora, não funciona" ou "se eu volto, a casa volta". Nenhuma das duas é o que o sistema sabe. Além disso, a frase repete em seis quadros.
Solução, por quadro (o que fazer de longe):
- Casa não respondeu / NAS fora: "Pode esperar. Nada foi perdido e nada se resolve daqui: quando a forja e o NAS voltarem, peça de novo." Se for octógono (36 h ou mais): acrescentar "Se passar de 36 horas, o painel de saúde avisa" só se esse aviso existir; senão, não prometer.
- Incompleto (casa deixou de responder no meio): "Peça de novo quando a casa voltar; só os 2 meses que faltam serão lidos de novo" só se for verdade no spec; senão "Peça de novo". Não afirmar ganho que o dado não sustenta.
- Não medido: "Abra a página de novo em alguns minutos." e o "Pode esperar" some (a frase já diz o que fazer).
O Cowork não aparece como saída em nenhum desses quadros: correto, manter assim (ele não muda variável do Vercel, e nada aqui precisa de variável).

### C4. "Arquivo não bate": duas frases afirmam mais do que o dado sustenta (corrige)
"Enquanto isso o automático não tira mês nenhum do banco" e "deixe para o Claude Code conferir esse mês quando você voltar." A primeira é uma garantia de comportamento do sistema escrita numa tela de leitura; se o spec não a fixa em 04, sai (e se fixa, citar a linha no ⓘ). A segunda manda o dono para uma ferramenta sem dizer o que ele diz lá. Também: "Faltam 1 de 12 meses" (concordância). Solução: "Falta 1 de 12 meses: setembro de 2027. Os outros 11 vieram. O mês continua guardado no NAS e no B2, sem mudança. Pode esperar até você voltar; ao voltar, peça ao Claude Code para conferir setembro de 2027." Octógono mantido (a forma é do spec); o dono não precisa de mais nada de longe.

### S1. Painel abre abaixo da dobra a 390 px (sugestão)
Com o gráfico, a legenda e o texto de introdução do mockup, o "Pedir" fica 1 rolagem abaixo. Na tela real a introdução não existe, mas o painel ainda abre abaixo do gráfico: ao tocar "Ver antigo", rolar até o painel (e focá-lo, o que já ocorre) para o botão Pedir entrar na tela. Verificar na tela real.

### S2. Mês que falta aparece no meio de 12 linhas (sugestão)
No "Incompleto", os 2 meses que faltam são a 4ª e a 5ª linha, e a frase de cima já os nomeia. Aceitável. Se a lista passar de 12 (24, 36 meses), subir os meses que faltam para o topo da lista, sob a frase, e recolher os que vieram bem.

### S3. Ficha do vídeo: duas datas parecidas (sugestão)
"41,2 mil views, lido em 18/02" e "Na passagem à leitura mensal, em 21/02/2028" na mesma linha confundem "quando foi lido" com "quando passou". Separar: "Contagem na passagem (21/02/2028): 41,2 mil views, lida em 18/02."

### S4. Perfil "Edita" é igual ao "Administra" (sugestão)
Confirmar com o spec (04 L39) se o editor pede período longo; se pedir, nada a mudar; se não, o editor cai no caso "só lê".

## Decisões do desenhista (19e §3 do ROTEIRO), veredito
1. **Resultado traz dias medidos e views do mês (além da cobertura): aceito.** Dá a leitura de relance; a barra mini por mês é a proporção desenhada. Sem risco de número inventado: ambos vêm da série.
2. **Exemplo de 12 meses no lugar de 24: aceito com ressalva** (ver C2: o período escolhido tem de valer na espera e no resultado, ou a nota declara o corte).
3. **"Tudo" = 50 meses vira "grande demais": aceito o estado, rejeitado o momento** (ver B2: avisar antes de pedir).
4. **Leitor "só lê" não vê o botão: aceito**, desde que a frase do trecho mude (B1).
5. **Cada falha ganha "Pode esperar"; "arquivo não bate" manda para o Claude Code: aceito o princípio, texto a trocar** (C3 e C4). Cowork fora da saída: certo.

## Para a Naksu (uma linha cada, não medi)
Contraste do texto âmbar/vermelho nos avisos e na barra mini; alvos de 44 px no "Ver antigo" a 1440 com ponteiro fino; desenho do octógono vs triângulo a 16 px em escala de cinza nas linhas dos meses.

## Para entrar "pronto para o dono"
B1, B2, B3 corrigidos e C1 a C4 corrigidos; sugestões a critério do desenhista. Nova rodada só nos quadros `pagina`, `todos-antes`, `todos-erro` e `perfil=le`.
