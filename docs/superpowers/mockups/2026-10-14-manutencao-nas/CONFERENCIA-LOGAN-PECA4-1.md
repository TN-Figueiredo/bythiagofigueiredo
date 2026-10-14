# Conferência Logan (UX), peça 4, após a rodada 1 (commit 388176738)

Método: Playwright sobre `file://`, 390 px, `arquivo.html` (`?auto=desl-1`, `desl-2`, `desl-8`, `desl-9`, `lig`, `perto`, `perfil=ed`) e `interruptor.html`. Erros de script: 0. Lido o NOTAS "Revisão peça4-1". Decisões do dono de 14/10 (botão Desligar; motivo 8 neutro) tratadas como lei.

## Achados A1 a A9 e sugestões

| Achado | Estado | Evidência |
|---|---|---|
| A1 chip -> painel; frase-resumo | resolvido | O chip aponta para `#auto-dia`; após o clique, `scrollY` 2447 e foco em `auto-dia`. A frase-resumo abre com "O automático de views por dia e o de leitura de hora em hora desligaram em 02/05: a casa ficou mais de 36 horas sem responder." (link). Chip: 1 gesto até o motivo, no lugar das 3 rolagens. |
| A2 "visto" ao ver | resolvido | IntersectionObserver, meia tela por 1 s. Com dois tipos parados, o chip fica até os dois painéis serem vistos (declarado; aceito, é o certo). |
| A3 caminho de volta | resolvido | "Ver o que sairia" no painel parado, "Ligar de novo" com "Falta ver o que sairia" ao lado, uma linha só de explicação. Fluxo medido: chip, ver, ligar, frase, ligado = 5 gestos mais digitação. Ressalva (sugestão, não bloqueia): no "ainda não dá" o botão só mostra a simulação e não conta; no produto tem de contar, senão o dono vê e continua "0 de 2". Vai ao fecho do spec. |
| A4 "o que fazer" fora de casa | resolvido | Linha fixa de tranquilidade em todos; "Pode esperar" em 2, 3, 3b, 4, 10, 13; "aviso da casa" nos dois lados do motivo 2; quadro 2V "A casa voltou a responder em 03/05"; 9 e 11 sem "quem cuida do site"; 11 declara que a frase é exemplo. Ressalva menor: no motivo 2 o apontamento "veja o aviso da casa no topo" é fixo; no produto só aparece se o aviso existe (o 2V cobre o caso contrário, o fecho do spec precisa dizer que a escolha é pelo estado da casa, não pela data do desligamento). |
| A5 motivo 8 | resolvido (decisão do dono) | Sem chip (0), sem triângulo, texto "A validade de 90 dias acabou. Nada deu errado." "Perto de vencer" também neutro, sem chip. Divergência de 04 L310 e PLANO §1.2 declarada, vai ao fecho. |
| A6 ver a regra e parar | resolvido (decisão do dono) | "Ver a regra" e "Desligar" no painel ligado; Desligar confirma sem frase, foco em Cancelar, Esc devolve o foco ao botão, confirmar leva ao cartão "desligado". Perfil "edita": vê a regra, não vê Desligar (testado 1 e 0). ⓘ agora começa por "Toque em Desligar". |
| A7 frase sem acento | resolvido | "ligar automatico de views  por dia" (espaço duplo, sem acento) libera; frase parcial mostra "Ainda não bate com a frase. Maiúscula e acento não importam." |
| A8 quinze itens antes do campo | resolvido | Quatro grupos com título; os 11 motivos mantidos; frase e botão fixos no rodapé da janela. |
| A9 `interruptor.html` | resolvido | Abre com as três linhas para o dono; nenhum código ("A-INDO", "spec 04 L") visível; quadros agrupados em quatro (casa/cópia, arquivo/banco, banco cheio/sem medida, validade/configuração), os 13 ficam por `?e=cN`. |
| S1, S2, S3, S5, "perto de vencer" | aplicados | Painel parado enxuto, `aria-label` com o tipo, "Último que saiu", desligado em uma linha, perto de vencer neutro. |
| S4 ("a cada 5 meses" sozinho) | não aplicada, aceita | É frase do spec; volta ao fecho como remessa. |
| Alvo de 44 px do link da frase-resumo | resolvido | Declarado 0 alvos abaixo de 44 px a 390; é da Naksu confirmar. |

## As 3 decisões novas do desenhista

1. **Religar depois de Desligar sem simulação nova: aprovada.** Quem parou foi o dono, não uma falha; as 3 saídas e 2 simulações continuam cumpridas, e ainda há regra e frase. Exigir simulação ali seria atrito sem motivo. Condição: o fecho do spec registra que a dispensa vale só para "desligado por você" (nunca para "desligou sozinho"), e Phil confirma que nada no dado mudou a ponto de a simulação antiga enganar (a simulação mostra o que sairia agora, não histórica).
2. **ⓘ "deixe para o Claude Code ou o Cowork": aprovada, com nota.** Resolve o A4(d) e o A6 (diz quem faz). Confirmar que os dois conseguem de fato mudar a variável (Vercel); se só o Claude Code consegue, o texto deve citar só ele. Isto é de fato, não de UX; fica anotado para o dono confirmar.
3. **"Aviso da casa" no motivo 2: aprovada.** O mesmo nome nos dois lados, e o 2V cobre a casa que voltou. Diverge de 04 ("aviso do banco"); remessa ao fecho já declarada.

## Pendentes (nenhum bloqueia a peça)

- Remessas ao fecho do spec 04: motivo 8 neutro, botão Desligar, "aviso da casa", S4, e a regra "Desligar não exige simulação nova".
- No produto, "Ver o que sairia" do painel "ainda não dá" tem de contar a simulação.
- Não verificado: Opera real, leitor de tela, aparelho real, rede ruim, tema claro (Naksu).

## Veredito

Peça 4: **pronto para o dono**, do lado do Logan. Acordo de UX: sim. Falta o OK da Naksu na conferência dela e as remessas ao fecho acima.
