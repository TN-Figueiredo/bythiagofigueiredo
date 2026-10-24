# F3b Adiar 7 dias: revisão de UI, rodada 2 (Naksu, 23/10)

**Nota: 93/100. Aprova: NÃO** (1 achado "corrige", uma regra de CSS). N2 resolvido; N1 resolvido para "Painel aberto", mas o mesmo defeito reaparece em "Vence em até 7 dias". Remeço só isso.

Método: Playwright headless, `file://`. Varredura de largura do contêiner `.sg` (frame = largura + 2) de 560 a 780 px, passo 1 px, nos dois estados com painel, detectando `‖` sem vizinho na mesma fileira. Capturas em `ui-revisao-shots/r2-*` (inclui `r2-dsp-<estado>-<700|701|720|760>.png`).

## Conferido, resolvido
- **N1 em `adiar-aberto`:** 0 órfãos em 560-780. A 700 px: fios horizontais, 3 fileiras (`r2-dsp-adiar-aberto-700.png`); a 701: 2 fileiras, `Já fiz | ‖ Adiar 7 dias` juntos, Cancelar na 2ª (`...-701.png`). Sem salto ruim.
- **N2:** margem de `.sg-adl` 8 px, `.sg-blkmeta` 4 px (bloco `ctx-ablab-adiadas`: 4 px nas duas ocorrências), `.sg-venm` 8 px a 390 com intervalo medido de 8 px até a régua (era 0). Em 1440 o selo "Adiada por você" não aparece (`.sg-venm` só no container <=640, como projetado).
- **N3 aplicado:** `‖` e fios em `--btn-line`: 3,92:1 / 3,78:1 (escuro, sobre `--sunk` / `--bg`), 3,45:1 / 3,66:1 (claro). Passa 3:1 nos dois temas. Fio de 390: 314x1 px, mesma cor.
- 1440: hscroll 0, `.sg` 1390 px, painel em 1 fileira. 390: hscroll 0, `.sg` 366 px, **0 botões abaixo de 44x44**; a 1440 só a regra herdada da F3 (36 px / ⓘ 28). `color-mix` = 0.

## Achado

### N6. corrige: `‖` órfão em `adiar-vence-antes` entre 701 e 791 px de contêiner (91 larguras)
- Tela/estado: `adiar-vence-antes`, escuro (claro herda a mesma CSS), contêiner `.sg` de 701 a 791 px. Captura `r2-dsp-adiar-vence-antes-701.png`.
- Defeito: acima de 700 os separadores voltam a traço vertical; a frase "Vence em qua, 28/10: não dá para adiar 7 dias." (`p.sg-vence`, `flex:1 1 220px`) não cabe depois do `‖` e cai para a 2ª fileira com Cancelar. O `‖` fica pendurado no fim da 1ª fileira, depois de "Já fiz", sem nada depois: o mesmo defeito do N1. Medido: fileira 1 termina em `‖`, frase em fileira 2, para todo w de 701 a 791.
- Importa: coluna estreita do CMS / tablet; o `‖` promete um 3º grupo que não está ali.
- Correção (no bloco DELTA, junto do `@container (max-width:700px)`), CSS puro sem `:has`: marcar o separador no markup (`row()`/painel, linha ~336: `class="sg-sep sg-sep2 sg-sep-v"` quando o botão dá lugar à frase) e acrescentar
```css
@container (max-width:791px){
 .sg-dsp .sg-sep.sg-sep-v{display:none}
 .sg-dsp p.sg-vence{flex:1 1 100%}
}
```
  Em 701-791 a frase ocupa a 2ª fileira inteira (com Cancelar abaixo ou ao lado conforme couber) e some o `‖`; de 792 em diante frase e `‖` seguem na mesma fileira como em 1440. Alternativa sem número mágico: `.sg-dsp .sg-sep.sg-sep-v{display:none}` em todas as larguras (o vão de 16 px já separa "Já fiz" da frase, que é texto, não botão). Prefiro a alternativa: menos CSS, e a frase não é um grupo de ação que precise de delimitador. Reconferir varrendo 560-1100 (esperado: 0 órfãos).

## Para o Logan / herdado
Nada novo. N4 e N5 da rodada 1 seguem fora do escopo, como o controlador decidiu.

## Não verificado
Leitor de tela, Opera real, aparelho de toque real, rede lenta. Varredura só em tema escuro (a CSS de layout é idêntica nos dois temas; contraste medido nos dois).
