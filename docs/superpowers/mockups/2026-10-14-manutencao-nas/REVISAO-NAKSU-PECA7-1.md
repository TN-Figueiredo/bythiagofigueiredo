# Revisão Naksu, peça 7 (arquivo pendente na fila "Saíram do YouTube"), rodada 1

Arquivos: `19-mes-fora-do-banco/peca7.html`, `peca7.js`, `peca7.css` (m19.css só lido). Capturas e `medidas.json` em `revisao-naksu-shots/peca7-1/` (8 estados x 1440/390 x claro/escuro, cinza, texto hostil em 1440/390/820, "Já rodei"). Aberto por `file://`; nenhum servidor foi subido (47701 intocada).

## Veredito: VOLTA PARA AJUSTE (leve). Nenhum bloqueante. 3 "corrige", 4 sugestões.

Resumo: 1 tela, 8 estados. Os 3 defeitos que mais pesam: (1) o comando não tem botão "Copiar"; (2) hierarquia de títulos plana (grupo e item são o mesmo h3 de 15 px); (3) exemplo de comentários contradiz o spec (30 dias de carência) e "Já rodei" deixa referência quebrada e sem aviso a leitor de tela.

## 1. O que acerta (preservar)
- Estado por forma + cor: octógono (>=60 d), triângulo (>=30 d), caixa de arquivo (<30 d), além da borda 2 px e do texto "há N dias". Em escala de cinza (cinza-390-claro.png) o octógono/triângulo/caixa se distinguem e o comprimento da barra também; a leitura se mantém.
- Barra 0-60 com cortes 30/60 rotulados no próprio eixo, só hex/rgba literais, nenhum color-mix, 12 px mínimo.
- Zero rolagem horizontal em 1440, 820 e 390, em todos os 8 estados e nos dois temas. Texto hostil (título de 100+ caracteres sem espaço, canal de 100, número de 7 dígitos, comando de 120 caracteres): quebra decidida (`overflow-wrap:anywhere`), nada estoura (hostil-390/1440.png).
- Alvos a 390 px: todos os botões e links com 44 px; foco 2 px sólido `--accent` em todos os 14 primeiros Tabs; ordem do Tab = ordem visual.
- Frase de alerta com texto em `--text`; estados vazio (zero medido, borda 2 px `--im-zero`) e "não medido" (hachura + motivo) com forma própria.

## 2. Achados

### C1. CORRIGE. Comando sem botão "Copiar" (1440 e 390, ambos os temas)
Evidência: `document.querySelectorAll('[data-copy],button[aria-label*=opiar]').length = 0`; os `<code>` do passo 1 e 2 são texto corrido (`white-space:normal`), e a 390 px o comando quebra no meio do nome (`scripts/obs-` / `arquivo.ts`, comandos-1-390-escuro.png; com canal longo, 3 linhas). Selecionar com o dedo uma frase que quebra em 3 linhas dentro de um parágrafo é o passo mais propenso a erro da tela, e é um comando que apaga dado.
Correção: cada comando vira bloco próprio (`<pre class="p7-sh">` em `--sunk`, `font:12.5px var(--mono)`, `white-space:pre-wrap; overflow-wrap:anywhere`) com `<button class="btn small">Copiar</button>` ao lado (44 px a 390, 32 px no desktop como `.btn.small`), `aria-label="Copiar o comando do passo 1"`. Ao clicar: texto vira "Copiado" por 2 s, mais `<span role="status" class="sr-only">Comando copiado</span>`; sem movimento, só texto; se `navigator.clipboard` falhar, seleciona o bloco (`user-select:all`) e diz "Selecione e copie". O texto do passo ("Ele grava um arquivo...") fica fora do bloco.

### C2. CORRIGE. Hierarquia de títulos plana
`.p7-gt` (grupo, h3) e `.p7-it h3` (item) são ambos 600 15px/1.35; o h3 do item também é h3 no DOM. Quem navega por títulos não distingue grupo de item, e a vista não distingue "Esperam você rodar os comandos (3)" do título do vídeo (captura cheia-1440-escuro). Correção: `.p7-gt` mantém h3 15 px/600 com `margin:22px 0 8px`; título de item vira `<h4>` 14.5 px/600 (mesmo tamanho do corpo `.p7-res p`, escala do produto já tem 14.5), ou o grupo ganha `border-top:1px solid var(--border)` + `padding-top:14px` para separar. O grupo "Esperam a sua resposta" usa `.m-h3` inline `style="font-weight:600"`: trocar por `h4` com a mesma classe.

### C3. CORRIGE. "Já rodei": referência quebrada e sem aviso (390, ambos os temas)
Evidência: após o clique `#it-a` mantém `aria-labelledby="t-a"` e o `#t-a` foi removido pelo `innerHTML`; não há `role="status"` na página. O foco vai ao `div.p7-marc` (`tabindex=-1`), o que anuncia o conteúdo, mas o item perde título e não há como desfazer um clique acidental (botão "Já rodei" fica ao lado de "Ver os comandos", 8 px de vão a 390 px, mesma largura e peso).
Correção: (a) ao marcar, remover `aria-labelledby` do `li` ou manter o `h4` no resultado: "<título>: marcado como rodado em 03/05"; (b) pôr `role="status"` no contêiner da mensagem; (c) botão "Desfazer" (44 px) por 10 s ou até a próxima verificação, já que o spec diz que o item só volta se a verificação refutar; (d) `.p7-ac` com `gap:12px` a 390 px e "Já rodei" sem borda forte maior que a de "Ver os comandos" (hoje iguais; ok), mas separar por 12 px reduz o toque errado.

### C4. CORRIGE (dado de exemplo). Item de comentários contradiz o spec
Spec 04 L397: a cópia antiga de comentários "aparece 30 dias depois de a cópia nova estar verificada". O item c diz "substituída em 25/04" e "há 8 dias" na fila, o que só fecha se a barra contar desde a substituição. Correção: usar duas datas: "substituída em 25/03" (a fila a mostra desde 24/04, barra de 8 dias). Texto do item do Logan; a incoerência de dado é minha.

### S1. SUGESTÃO. "Ver os comandos" não muda de rótulo ao abrir
`aria-expanded=true` mas o texto fica "Ver os comandos" (medido). Trocar para "Esconder os comandos" ao abrir, por texto, não só por atributo.

### S2. SUGESTÃO. Frase de bloqueio repetida duas vezes, idêntica (bloqueado-390-claro.png)
Ocupa ~190 px por item a 390 px (380 no total). Uma única faixa acima dos dois itens ("Setembro de 2027 saiu das telas...") e, em cada item, só "Apagar indisponível: veja acima" em `.m-ausente.pt` de uma linha. Reusa `.m-ausente.pt` já existente.

### S3. SUGESTÃO. Barra capada em 100% esconde a gravidade acima de 60
63 dias e 200 dias desenham a mesma barra cheia. O número "há N dias" carrega o dado, então aceitável; se quiser, "60+ dias" no rótulo final quando `dias>60`.

### S4. SUGESTÃO. Vermelho x âmbar em cinza só se separa pela forma e comprimento
Bordas 2 px de ambos ficam do mesmo cinza (cinza-390-claro.png). Aceitável porque cada item tem octógono/triângulo + número; manter o ícone com 16 px nunca menor. Para o Logan: a contradição de "Apagar vídeo bloqueado" com o item a (setembro de 2027) que oferece "apagar-antigas" na mesma tela precisa de explicação no texto.

## 3. Tabela de medidas

| Par | Claro | Escuro |
|---|---|---|
| Título do item sobre fundo vermelho | 13,28 | 13,83 |
| `.p7-k`/`.p7-pode` (muted) sobre vermelho | 6,01 | 5,90 |
| muted sobre âmbar | 6,00 | 5,41 |
| muted sobre neutro | 7,13 | 6,18 |
| eixo 0/30/60 (12 px mono) | 6,43 | 6,92 |
| texto dos passos / rótulo da régua sobre âmbar | 6,83 | 6,67 |
| `code` sobre `--sunk` | 14,21 | 16,20 |
| Preenchimento da barra vs trilho: vermelho / âmbar / neutro | 5,55 / 4,24 / 6,43 | 6,25 / 8,62 / 6,92 |
| Marca 30/60 vs trilho | 14,21 | 16,20 |
| Borda 2 px vermelha / âmbar vs página | 5,90 / 4,50 | 6,03 / 8,31 |
| Borda 1 px do item neutro vs página (decorativa, sem significado) | 1,34 | 1,31 |

Alvos: 390 px, todos 44 px; 1440 px, `.btn` 36 px, `.btn.small` 32 (padrão do produto, como as peças 1 a 4). Fontes: mínimo 12 px (eixo e rótulos da régua; selo do mockup 12). Larguras: conteúdo 1072 px (L.obs) em 1440, sem rolagem horizontal em 1440/820/390. Valores soltos: `style="margin:0"`/`style="font-weight:600"` inline em `peca7.js` (títulos h2 e `.m-h3`); `.p7-it` grid `340px` e `.p7-cmd .m-reg{max-width:520px}` fixos (aceitáveis, mas fora de token); `.p7-chipn` duplica o chip de contagem da nav (usar `.m-chip` se existir variante).

## 4. Não verifiquei
Leitor de tela real (só inferi por atributos), Opera real (só Chromium; revisei o CSS: nenhum `color-mix`), aparelho real, rede lenta/fontes do Google (fallback de fonte ao abrir offline), clique do Esc no ⓘ, o texto da seção do spec (conteúdo é do Logan).
