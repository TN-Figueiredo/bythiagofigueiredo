# Mockup 16b: aba Mudanças, "Outras mudanças" fora da conta Trocas

Abrir: `cd` nesta pasta, `python3 -m http.server <porta 47710-47790> --bind 127.0.0.1`, `index.html?caso=<estado>` (`&tema=claro` liga o claro). Tudo é exemplo (a marca "exemplo" está na tela). Hoje = 13/10/2026.

**Achado de numeração:** a tabela 6.2 do spec lista "Trocas / Mudanças" (04-medidas-telas-e-mockups.md, linha 85) mas a lista numerada de 6.5b não a numera. Chamei de **16b** para não colidir.

## Estados (`?caso=`)
| caso | o que mostra |
|---|---|
| `trocas` | a visão padrão ("Trocas", como hoje, só um marcador de lugar) com a caixa de cima nova |
| `tipico` | 15 dias de histórico, 5 outras mudanças em 4 vídeos, 12 trocas. `&janela=7` e `&janela=90` mostram que a caixa de cima não muda (r1/B1) |
| `magro` | 7 dias de histórico, 1 mudança (o caso real por semanas) |
| `extremo` | 90 dias de histórico (214 mudanças); a conta de cima é dos últimos 30 dias: 94 mudanças em 65 vídeos, 52 tags, cartão com 5 mudanças e uma troca de 15 tags, "Mostrar mais" |
| `zero` | histórico existe desde 29/09 e nada mudou: zero medido |
| `nao-medido` | o histórico começa em 17/10 (data de exemplo): tudo hachurado |
| `filtro-zero` | o filtro Formato (0) dentro do caso típico |
| `erro` | só a lista nova falha; a conta Trocas e a aba seguem certas |
| `carregando` | esqueleto, `aria-busy` |
| `vazio` | sem dado: nicho sem canal (nada a contar; contorno pontilhado, nunca zero) |
| `leitura` | só leitura (ver dúvida 4) |

Respondem ao clique em qualquer estado: visão, Janela, Formato do vídeo, Ordenar, tipo, "Mostrar mais N", "Tentar de novo". Capturas: `shots/index-caso-<caso>-<1440|390>-<escuro|claro>.png` (11 casos x 4 cruzamentos; o par obrigatório é 1440 escuro e 390 claro). `shots/medidas.json`: rolagem horizontal 0, fontes menores que 12 px 0, alvos menores que 44 px a 390 0, nos 44 cruzamentos.

## Decisões de desenho e por quê
1. **Visão separada, não um botão a mais no filtro Tipo.** Um "Outras" dentro do Tipo faria o "Todos" virar 17 e empurraria a contagem da aba. Um seletor de visão "Trocas 12 | Outras mudanças 5" com a contagem de cada uma mantém as duas contas inteiras e deixa a lista de trocas de hoje intacta (item 39 de aceite).
2. **A contagem da aba não muda** (12 continua 12, também no extremo: 63). O 5 só existe dentro da caixa nova e da visão nova. A soma 12 + 5 = 17 não aparece em lugar nenhum (tabela "A conta" no rodapé de referência).
3. **Duas barras com uma linha tracejada entre elas ("a conta da aba acaba aqui")**: trocas em barra cheia, outras em barra só de contorno, na mesma escala. Cheia contra vazada diz "são coisas diferentes" sem matiz novo.
4. **A forma memorável é a régua de cobertura.** As outras mudanças só têm histórico desde o deploy da E1. Sem a régua, "5" parece "5 em 30 dias" e é "5 em 15 dias medidos". A régua desenha a janela inteira: dias sem histórico em hachura rosa (não medido), dia com histórico e sem mudança em traço baixo (zero medido), dia com mudança em coluna. O texto da conta diz "histórico de 15 dos 30 dias". Pergunta do sistema que falha em verde ("o que acontece quando o dado não existe?") respondida na tela.
5. **Mudança de campo não é direção:** nenhum verde nem âmbar. Neutro `--tr` e o tipo pelo símbolo e pela palavra (etiqueta, quatro quadrados, relógio, lista com marcas, retângulo largo e estreito).
6. **Antes e depois por tipo, cada um na sua forma:** tags com "+" (contorno cheio) e "−" (riscado, tracejado) mais "12 → 14 tags +2"; categoria com as duas categorias lado a lado; duração com duas barras proporcionais e o sinal da diferença; capítulos com uma régua de marcas antes e depois; formato com Longo → Short e o retângulo largo ou estreito. Mais de 6 tags: "mais N tags" (botão de 44 px). Mais de 3 mudanças num vídeo: "mais N mudanças deste vídeo".
7. **Agrupado por vídeo:** o vídeo aparece uma vez, com uma linha por mudança. A janela é "entre 12h e 18h" (a conferência é a cada 6 h), com ⓘ.
8. **O filtro de tipo é também a contagem por tipo** (símbolo, nome, número); o zero é a caixa vazada, o não medido é a hachura. A soma fecha: 2 + 1 + 1 + 1 + 0 = 5.
9. **Cor estável:** hachura rosa = não medido; caixa vazada `--im-zero` = zero medido; contorno pontilhado = ainda não existe (nicho sem canal); família do erro = erro (texto em `--text`). "+ novo" tracejado verde-água em dois lugares: a caixa de cima e o bloco da visão.
10. **Descrição fica como está** (lugar à parte, aprovado): não entra nem no 12 nem no 5.
11. **Paginação de 10 em 10** ("Mostrando 10 de 65 vídeos" + "Mostrar mais 10"), a regra herdada do lote 1.
12. **Erro isolado:** só a lista nova falha; o texto diz que as trocas e o número da aba não foram afetados. A frase de cima não imprime número onde não há (nada de "0" onde falhou).

## Tabela de frases da tela (texto exato)
| Onde | Texto |
|---|---|
| Frase de cima, com dado | "**12** trocas de título ou miniatura nos últimos 30 dias; mais **5** outras mudanças no mesmo período, fora desta conta." (singular: "1 troca", "1 outra mudança"). Fixa em 30 dias, como a aba; não segue a janela nem o formato escolhidos abaixo |
| Frase de cima, zero medido | "12 trocas de título ou miniatura nos últimos 30 dias; nenhuma outra mudança desde 29/09, fora desta conta." |
| Frase de cima, não medido | "12 trocas de título ou miniatura nos últimos 30 dias; as outras mudanças ainda não são medidas: o Observatório passa a guardá-las em 17/10." |
| Frase de cima, erro | "12 trocas de título ou miniatura nos últimos 30 dias; as outras mudanças não carregaram." |
| Frase de cima, carregando | "12 trocas de título ou miniatura nos últimos 30 dias; carregando as outras mudanças…" |
| Frase de cima, sem canal | "Nenhum canal acompanhado neste nicho: não há o que contar." |
| Barras | "Trocas" / "título e miniatura · 30 dias"; "Outras mudanças" / "tags, categoria, duração, capítulos e formato"; separador "a conta da aba acaba aqui" |
| Subtítulo da barra de outras | "histórico de 15 dos 30 dias" (ou "histórico dos 30 dias"); "nenhuma desde 29/09"; "passa a guardar em 17/10"; "só esta conta falhou"; "carregando" |
| Pastilhas da barra | "não medido"; "não carregou"; "sem canais"; caixa vazada "0" |
| Seletor de visão | "Trocas" / "Outras mudanças", só com o símbolo e o nome, sem número (a barra logo acima já tem o número; grupo: "O que mostrar abaixo") |
| Marca | "exemplo" + "canais, vídeos e números inventados" |
| Filtros | "Mudança feita nos últimos" 7 d, 30 d, 90 d; "Formato do vídeo" Todos, Longos, Shorts; "Ordenar" Mais recentes, Mais mudanças primeiro; "Só leitura" |
| Frase do bloco, com dado | "**5** mudanças em **4** vídeos, nos **15** dias com histórico (29/09 a 13/10)." / janela cheia: "…nos **30** dias da janela (14/09 a 13/10)." / com tipo: "**2** mudanças de tags em…" |
| Frase do bloco, zero | "Nenhuma outra mudança nos 15 dias com histórico (29/09 a 13/10)." |
| Frase do bloco, filtro sem resultado | "Nenhuma mudança de formato nos 15 dias com histórico (29/09 a 13/10); as outras 5 são de outros tipos." |
| Frase do bloco, não medido | "O histórico dessas mudanças começa em 17/10. Até lá, nada aqui é medido." |
| Régua | eixo "14/09" e "hoje 13/10"; legenda "sem histórico até 28/09 (não medido)" (ou "sem histórico: começa em 17/10"), "dia sem mudança", "dia com mudanças" |
| Tipos | "Todas", "Tags", "Categoria", "Duração", "Capítulos", "Formato" |
| Linha | tipo; "12 → 14 tags +2"; "+ street food", "− viagem barata"; "Viagem e eventos → Entretenimento"; "18:42 → 18:10"; "0 → 6 capítulos" com "antes / nenhum" e "depois / 6 marcas"; "Longo → Short"; "ter 13/10" e "entre 12h e 18h" |
| Cartão | "N mudanças no período"; "Ver histórico do vídeo"; "mais N tags"; "mais N mudanças deste vídeo"; "Horários em São Paulo" |
| Paginação | "Mostrando 10 de 65 vídeos"; "Mostrar mais 10" |
| Zero (painel) | "Nenhuma outra mudança desde 29/09" / "O histórico já existe e nada mudou. Isso é resultado: os canais não mexeram em tags, categoria, duração, capítulos nem formato nesse período." |
| Filtro sem resultado (painel) | "Nenhuma mudança de formato desde 29/09" / "Com o filtro de agora não há o que listar. As outras mudanças estão em outros tipos." / botão "Ver todas as mudanças" |
| Não medido (painel) | "Ainda não há histórico de tags, categoria, duração, capítulos nem formato" / "O Observatório passa a guardar estes campos em 17/10 (exemplo). Não é zero: ainda não dá para saber se algo mudou." |
| Erro (painel) | "As outras mudanças não carregaram" / "As trocas de título e miniatura não foram afetadas, e o número da aba continua certo. Tente de novo; se repetir, o problema é do Observatório, não dos canais." / botão "Tentar de novo" |
| Carregando | "Carregando as outras mudanças. As trocas de título e miniatura já estão acima." |
| Sem canal | "Nenhum canal no nicho IA" / "Sem canal acompanhado não há mudança para ler." / "Adicionar canal", "Ver todos os nichos" |
| ⓘ da frase de cima ("Por que as outras mudanças ficam fora da conta de Trocas") | Trocas = título e miniatura, a conta da aba, da lista de canais e da comparação, a única com efeito medido. Outras mudanças não têm efeito medido e acontecem por motivos diferentes; somar tudo inflaria o número da aba. Descrição tem lugar à parte e fica fora das duas; com esta tela a aba passa a contar só título e miniatura (hoje soma a descrição: o dono decide). A conta de cima é sempre dos últimos 30 dias, como a aba; a janela de baixo vale só para a lista. Contagem: cada mudança registrada nos últimos 30 dias, uma por campo e por sincronização. Cálculo do Observatório sobre dados públicos do YouTube. |
| ⓘ da régua ("Como ler a régua de dias") | hachura = o Observatório ainda não guardava esses campos (não é zero); traço baixo = dia com histórico e sem mudança; coluna = dia com mudanças (altura para em 6); o Observatório passou a guardar estes campos em dd/mm (exemplo). |
| ⓘ dos horários | "O Observatório confere os vídeos a cada 6 horas. Cada mudança mostra a janela entre duas conferências, não o minuto exato. Horários de São Paulo." |
| ⓘ de só leitura | "Nada desta lista é privado… Quem só lê vê o mesmo que quem edita. Só ficam desligados os botões de sincronizar e de adicionar canal." |

## Dúvidas para o dono (com o padrão adotado)
1. **DECIDIR PRIMEIRO. A descrição entra em algum desses números?** Em produção a aba conta título, miniatura e descrição. Hoje o filtro Tipo da aba já tem "Descrição" e o "Todos" dele a soma. O pedido manda a conta Trocas ser título + miniatura. Padrão: **12 = título + miniatura; a descrição continua à parte e fora dos dois números.** A aba hoje conta a descrição (`outliers.ts`, `TAB_TITLES.mud`): o 12 do mockup é a conta nova (a aba cairia) e o implementador decide (dúvida 5) como migrar.
2. **Nome do rótulo:** a aba se chama "Mudanças" e a frase diz "outras mudanças" (colisão de nomes, r1/S2): a aba deveria passar a "Trocas"? Além disso, "Outras mudanças" para o que não é título nem miniatura, e "o histórico dessas mudanças começa em dd/mm" no lugar de "histórico de campo" (jargão). Padrão: esses dois. Confirma?
3. **Idioma:** a E1 também guarda mudança de idioma, que o pedido não lista. Padrão: **fora** (cinco tipos). Entra como sexto tipo com o mesmo desenho se você quiser.
4. **Só leitura:** não há número privado nesta lista (dado público de canais de terceiros). Padrão: quem só lê vê **tudo igual**; ficam desligados só "Sincronizar concorrentes" e "Adicionar canal", e a tela diz isso num ⓘ. Se existir uma ação de linha (salvar no swipe file) para outras mudanças, ela seria a única coisa desligada para leitor; não desenhei porque não foi pedida.
5. **Capítulos:** não achei no spec da E1 uma coluna de histórico de capítulos (a E1 lista tags, categoria, duração, idioma, formato). Padrão: desenhei capítulos porque o pedido e a M5 os listam; se saírem da descrição, a mudança só é medida a partir do texto da descrição (dia de início pode ser outro). Preciso que o implementador confirme a fonte.
6. **Janelas diferentes:** o histórico de campo é mais curto que o de título e miniatura. Padrão: as duas contas usam a mesma janela escolhida e a régua mostra o pedaço medido. Alternativa: cortar a conta de trocas na mesma data (descartei: esconderia trocas medidas).

## O que o implementador precisa saber
- **Dados:** a visão lê o histórico de campo da E1 (tags, categoria, duração, formato; capítulos conforme a dúvida 5). A data de início do histórico é a do primeiro registro de campo **por canal ou global**: o mockup assume um dia só para todos os canais. Canal adicionado depois tem início próprio: aí a régua deveria ser por canal, ou a data global é a mais recente (decisão do implementador; o mockup não resolve).
- **A caixa de cima é fixa em 30 dias e sem filtro de formato** (a aba conta sempre 30 dias); só o bloco de baixo obedece à janela e ao formato. Em janela de 7 ou 90 dias, a caixa de cima não muda e a frase do bloco traz a janela dele.
- **Lista fechada de motivos (6.1.5):** "o histórico dessas mudanças começa em dd/mm" entra na lista fechada de motivos de dado ausente, como nos specs 02 e 03.
- **A contagem da aba e a conta Trocas não mudam de fórmula,** salvo a decisão da dúvida 1 (a aba hoje soma a descrição). A visão nova é uma leitura à parte; nada dela entra em `tabCounts`.
- **Estados são mutuamente exclusivos** e vêm da mesma regra: sem canal (nada a contar) > erro > carregando > início do histórico depois de hoje (não medido) > sem registro na janela (zero medido) > com registro. Filtro que esvazia a lista **não** é zero da janela: é "Nenhuma mudança de <tipo>", com botão para limpar.
- **Zero medido e não medido nunca trocam de aparência:** caixa vazada `--im-zero` e hachura rosa. Dia sem registro antes do início é hachura, nunca traço baixo.
- **Mudança de campo não usa cor de direção.** Duração mostra "+0:13" e "−0:32" em neutro.
- **Janela entre duas conferências:** "entre 12h e 18h" (a sincronização é a cada 6 h); fuso São Paulo.
- **Paginação:** 10 vídeos por vez, "Mostrar mais N"; dentro do cartão, 3 linhas e "mais N mudanças deste vídeo"; 6 chips de tag e "mais N tags".
- **Acessibilidade:** a régua é `role="img"` com `aria-label` por extenso (dias sem histórico, dias com histórico, total); os seletores são `role="group"` com `aria-pressed`; a frase de cima e a do bloco são um `<span>` só; chips de tag levam "acrescentada:" e "retirada:" para leitor de tela; erro tem `role="alert"`, carregando `role="status"` e `aria-busy`; popovers pela Popover API (como o lote).
- **Fora do que foi desenhado:** a lista de Trocas, o Ledger do resumo da semana e o cabeçalho do Observatório continuam como hoje (aparecem como marcador de lugar).
- **CSS:** sem `color-mix()` (`grep` só acha o comentário "Sem color-mix"; `a4.css` e `lote.css` são cópias do lote 1). `a4.css`, `a4-comum.js`, `lote.css` e `lote.js` aqui são cópias congeladas do lote 1; o que é desta tela está em `om.css`, `om.js` (prefixo `om-`).

## O que não foi verificado
- Leitor de tela, Safari, Opera e ordem de teclado completa (como no lote 1).
- Contraste conferido por conta nos pares novos: muted sobre cartão 6,18 (escuro) e 7,13 (claro); borda `--dim` sobre cartão 4,86 e 5,59; zero `--im-zero` 4,97 e 4,84; texto rosa sobre fundo rosa 6,77 e 6,37; erro 5,59 e 6,16. Texto sobre texto: igual ao do lote 1.
- Rodada 1 do `revisor-ux-senior` feita e respondida abaixo; falta a rodada 2 antes de ir ao dono. Leitor de tela, Safari e Opera continuam sem verificação. A régua de 90 dias a 390 px foi aberta: legível.

## Resposta à revisão r1
Capturas refeitas (11 casos mais `tipico` com 7 d e 90 d, 1440 e 390, claro e escuro) em `shots/`; medidas: rolagem horizontal 0, fonte menor que 12 px 0, alvo menor que 44 px a 390 0, nos 52 cruzamentos.
- **B1 (caixa de cima contradizia a aba): resolvido.** A caixa fica fixa em 30 dias, sem filtro de formato, e diz isso ("nos últimos 30 dias", "título e miniatura · 30 dias", ⓘ explica); a janela e o formato mandam só no bloco de baixo. Conferido a 7 d e 90 d: a caixa segue 12 e 5, a aba 12.
- **C1 (grupos sem nome): resolvido.** `aria-label="Mudança feita nos últimos"` e `aria-label="Formato do vídeo"` nos dois grupos.
- **C2 (sem dado contradizia o cabeçalho): resolvido.** No caso `vazio` a aba Canais mostra 0 e Mudanças e Outliers mostram "—", igual ao resto da tela.
- **C3 (tela afirmava o que a produção não faz): resolvido.** Tabela: "hoje conta título, miniatura e descrição; com esta tela passaria a título e miniatura (dúvida 1)"; ⓘ reescrito como proposta; dúvida 1 virou "DECIDIR PRIMEIRO" com a fórmula atual.
- **S1 (mesmo número cinco vezes): feito do jeito barato.** O seletor perdeu os números e ficou com símbolo e nome; a barra logo acima já traz o número.
- **S2 (colisão de nomes): vira pergunta ao dono** (dúvida 2: a aba passa a "Trocas"?). Não mudei a aba por conta própria.
- **S3 (jargão "coleta"): feito.** "O Observatório passa a guardar estes campos em 17/10" no painel, na frase de cima, na barra e no ⓘ da régua.
- **S4 (lista fechada de 6.1.5): anotado** em "O que o implementador precisa saber".
- **S5 (`aria-label` em `<span>`): feito.** `role="img"` nos spans de zero medido, "não carregou", "carregando" e "sem canais".
- **S6 (marca "exemplo" uma vez): mantida** como está; na implementação ela some.
- **S7 (barra "antes" da duração a 3,62:1): feito.** Opacidade de .55 para .7.

## Resposta à revisão r2
Só um trecho de texto mudou (`om.js` linha 332, `NOTAS.md`); nenhuma captura precisou ser refeita (o ⓘ só aparece aberto; a revisão pediu só reabrir o do típico, e a frase é a mesma em todos os casos).
- **B2 (ⓘ dizia "na janela escolhida"): resolvido.** `om.js:332` agora diz "Contagem: cada mudança registrada nos últimos 30 dias, uma por campo e por sincronização", coerente com o item "Janela" logo acima. A tabela de frases acima recebeu o mesmo texto.
- **M1 (botões do estado sem dado são `<span class="btn big">`): anotado.** Marcador de lugar no mockup; na implementação "Adicionar canal" e "Ver todos os nichos" têm de ser `button` ou `a`, com foco e leitura como botão.
- **M2 (faixa de frescor diz "7 canais" e o nicho IA tem 0): anotado.** A faixa de frescor continua global (todos os canais); a aba e a visão são do nicho escolhido. Se o dono estranhar, vale uma palavra na faixa ("7 canais no total").
- **M3 (descrição do extremo): corrigida** na tabela de casos: 90 dias de histórico e 214 mudanças; a caixa de cima (30 dias) mostra 94.
- **M4 (dúvida 2, nome da aba): segue como pergunta ao dono**, sem mudança.
