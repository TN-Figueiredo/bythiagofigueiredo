# Revisão de UI (Naksu): Referências e Inscritos implementado (HEAD 0a6aceee1)

Veredito: **CORRIGE** (1 defeito medido, 1 linha de CSS). O resto está pronto para o dono. Sem navegador: li 14 capturas de `shots-implementado/` e `reconferencia/` (1440 e 390; escuro e claro; cheio, magro, vazio, antigo; régua e abas grudadas; sem conexão) e o CSS do worktree wt-ri; as medidas de pixel são as do Gio, conferidas contra o CSS.

## O que acerta (preservar)
- Régua log com ticks 0/50/100 % e rótulos "10 mil / 100 mil / 1 mi" alinhados à coluna da régua; faixa, marca, trilho tracejado da provisória e marca vazada distinguem os estados por forma, não só por cor.
- "Sem medida" é estado visível (pílula rosa hachurada com o motivo escrito), nunca zero; "▲ ▼ ＝" com número em Inscritos; lê em cinza.
- Linha de valor em 12 px mono alinhada à direita (algarismos tabulares), 1 a 2 linhas a 1440; no 390 quebra em até 3 linhas sem cortar (aceitável, coluna de 112 px).
- Aviso de coleta antiga e "Sem conexão." em `.ri-aviso` tracejado, legível; vazio com caixa tracejada e frase de duas partes.

## Achado

### 1. CORRIGE (menor) · 390 px, abas grudadas: fresta de 4 px sob a topbar, com texto da página aparecendo
- Tela Canais, Referências/Inscritos, a 390 (vale até 768), escuro e claro.
- Evidência: `_shared/cms-topbar.css:100-105` `@media(max-width:768px){.cms-topbar{height:48px}}`, mas `_canais/canais.css:7` fixa `--obs-topbar-h:52px` sem exceção. `.ri-abas{top:var(--obs-topbar-h)}` (`ri.css:71`) e `--stk` (`ri.css:70`) grudam a 52, 4 px abaixo do fim da barra (48). Visível em `reconferencia/grudado-390.png`: faixa de texto ("um vídeo para outro...") entre a barra e as abas. A régua (`--stk` = 52+56 = 108) herda a mesma folga, e `scroll-margin-top` (ri.css:5, 11) também.
- Por que importa: texto cortado a meio aparece sobre a tela que o dono rola com o polegar; é o estado mais usado no celular.
- Correção exata, em `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/canais.css`, logo depois do bloco que termina na linha 14 (fecha o `[data-obs-screen="canais"]{...}`):

```css
@media (max-width:768px){[data-obs-screen="canais"]{--obs-topbar-h:48px}}
```
  Atualizar o comentário da linha 6 para "52 px; 48 px até 768 px (cms-topbar.css:100)". Não mexer em `ri.css`: ele já lê a variável. Teste que falta (spec de navegador, 390): depois de rolar o `main` 500 px, `.ri-abas.getBoundingClientRect().top === document.querySelector('.cms-topbar').getBoundingClientRect().bottom` (48). Observação: entre 769 e 899 px a topbar é 52 e as abas já estão corretas.

## Sugestões (não bloqueiam)
- Bordas dos botões "Ordenar por", "Ver todos os N" e do chip "seu canal": 1,37 a 1,77:1 contra o fundo (apontado pelo Gio; herdado de `.btn`). O estado ativo se distingue por peso 600, fundo e sublinhado de 2 px (não só por cor), então o significado não depende da borda; tratar no `.btn` global, não aqui.
- "Sem medida" a 390 ocupa 2 linhas na pílula de largura total (`cheio-390-dark-ref.png`); OK, sem corte.

## Tabela de medidas
| Item | Valor | Fonte |
|---|---|---|
| Topbar 1440 / 390 | 52 / 48 px | cms-topbar.css |
| `--obs-topbar-h` hoje | 52 px nas duas larguras | canais.css:7 |
| Fresta abas a 390 | 4 px (52-48) | Gio + CSS |
| Abas, altura / alvo | 56 px / `.btn` min-height 44 px | ri.css:71-72 |
| Régua grudada a 390 | top 108 (após correção: 104) | ri.css:70 |
| Contraste texto `nm2` / `pont` (pior caso, Gio) | 6,14 / 6,18 escuro; 6,37 / 7,13 claro | canvas, Gio |
| Borda `nm2` / `pont` (Gio) | 3,23 / 4,86 escuro; 3,94 / 5,59 claro | idem |
| `color-mix()` nas regras das seções | 0 | Gio |
| Rolagem horizontal | 0 em 4 larguras | Gio |

## Não verifiquei
Opera real, leitor de tela, estado de erro por seção (sem spec), aparelho real, rede lenta. Pixels medidos por mim: nenhum (sem navegador); os números vêm do parecer do Gio e do CSS.
