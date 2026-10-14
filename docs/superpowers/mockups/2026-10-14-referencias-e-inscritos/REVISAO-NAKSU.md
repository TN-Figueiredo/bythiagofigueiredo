# Revisão de UI (Naksu): Referências e Inscritos

Veredito: **REPROVADO como está** (volta ao autor). O defeito 1 derruba a tela em 1440 px; os demais são consertos. Com o defeito 1 e o 2 resolvidos, o desenho em si tem boa chance de passar.

Método: Playwright/Chromium headless sobre `file://`, 1440 e 390 px, claro e escuro, `cheio|magro|vazio` (18 capturas em `shots/`, nomes `LARGURA-TEMA-ESTADO.png`). Mais 2 capturas `...SIMULANDO-correcao-do-grid.png` (1440 escuro e 901 escuro), em que injetei `#app{display:block}` só no navegador para ver o desenho pretendido; o mockup não foi editado. Medi também 1100, 901 e 768 px. Sem erro de console em nenhuma combinação. Rolagem horizontal: nenhuma (scrollWidth = clientWidth em todas as 12 combinações). `color-mix()`: nenhum uso em `ri.css`/`ri.js`; as 3 ocorrências em `a4.css` são só comentários.

## O que acerta (preservar)
- A régua log com faixa p25-p75 e marca da mediana comunica constância pela forma; a simulação 1440 se lê de relance. Constância tem símbolo e palavra (＝ ～ ≋), não só cor.
- Barra divergente ▲/▼/＝ com cor, símbolo e número: lê em escala de cinza (▲▼＝ distintos, `--dir-up` e `--dir-dn` com luminâncias diferentes).
- "Não dá para medir" com hachura rosa da tela 16 e o motivo escrito na linha; nunca zero. Frase-resumo + ⓘ no padrão pedido pelo dono.
- Mobile 390: sem rolagem horizontal, alvos de 44 px (`.btn`, `.ibtn`), nome longo com reticências + `title`.

## Achados

### 1. BLOQUEIA: em ≥1101 px a tela inteira cai na coluna da barra lateral
- Tela: todas; 1440 e 1100+; claro e escuro; todos os estados.
- Evidência: `a4.css:64` `#app{display:grid;grid-template-columns:var(--side-w) minmax(0,1fr)}` (só vira 1 coluna em `@media(max-width:1100px)`, linha 75). O mockup põe `<main class="ri">` direto em `#app`, sem `.ch-side`, então `.ri` cai na coluna de 208 px. Medido a 1440: `.ri` = 169 px de largura (lista `li` 517 px; `.reg` 11 px; `.dv` 11 px). Na captura `1440-escuro-cheio.png` as réguas e barras são riscos de 11 px, o texto do estado "não dá para medir" quebra em coluna de 1 palavra por linha (`1440-claro-vazio.png`: caixa vazia com 6 a 8 linhas de 1 palavra), a maior parte do monitor está vazia. O autor não viu 1440 (NOTAS.md), por isso passou.
- Por que importa: é a largura do navegador do dono; o desenho pretendido só existe de 1100 px para baixo.
- Correção: dar ao mockup a moldura que a tela 16 usa (`.ch-side` + `.ch-main` com o conteúdo, ver achado 7), ou, no mínimo, `#app{display:block}` em `ri.css`. A simulação com `#app{display:block}` está em `shots/1440-escuro-cheio-SIMULANDO-correcao-do-grid.png` (`.ri` 1100 px, régua 518 px, `li` 1024 px).

### 2. CORRIGE: a escala "1 mil / 10 mil / 100 mil / 1 mi" está desalinhada e fora da régua
- Tela: Referências, desktop (medido na simulação 1440; também 1100/901).
- Evidência: `.escala` é `display:flex;justify-content:space-between` e tem a largura da lista inteira (1026 px, começa em x=207), enquanto a régua ocupa só a coluna do meio (518 px, começa em x=536). Os rótulos ficam sobre a coluna dos nomes. Além disso `space-between` põe os rótulos em 0/33/67/100 %, e as posições reais na escala log (`pos()` com 800 a 2.000.000) são **2,9 / 32,3 / 61,7 / 91,1 %**: erro de 5,7 pontos em "100 mil" e 8,9 em "1 mi". Uma marca em 1,2 mi parece encostar no "1 mi" mas é lida como mais do que é. Também não há linhas-guia nas linhas: com 22 linhas o cabeçalho sai da tela (1440: lista de ~1.490 px) e a régua perde a referência.
- Correção: (a) colocar a escala dentro de um grid com as mesmas colunas de `.lst>li` (`minmax(220px,300px) 1fr 150px`) e rótulos em `position:absolute;left:calc(X%)` com X = 2,9 / 32,3 / 61,7 / 91,1; (b) desenhar 4 ticks verticais finos (1 px, `var(--border-subtle)`) nesses mesmos X dentro de cada `.reg` (`background:linear-gradient` literal) e tornar o cabeçalho `position:sticky;top:0` com fundo `var(--surface)`; (c) no 390 px repetir a escala dentro de cada `.reg` não cabe, então os ticks de (b) mais o cabeçalho sticky bastam.

### 3. CORRIGE: o % da barra de inscritos é cortado em quase toda a lista
- Tela: Inscritos, 1440 (simulado) e 390, os dois temas.
- Evidência: `.dv .b` tem `overflow:hidden` e largura proporcional (mín. 4 % da coluna). 1440 simulado: **8 de 22** barras cortam o texto; 901 px: 12 de 22; 390 px: 12 de 22 (`scrollWidth` 62 px contra `clientWidth` 12 a 55 px). Na captura as barras de ranking 10 a 22 mostram "▲ +3", "▲ +", só o ▲, e as duas de queda mostram ".2%" e "0%" (o sinal e o ▼ somem). O número que a linha-resumo promete ("% dentro da barra") não aparece justo onde há queda.
- Correção: tirar o % de dentro da barra; mostrá-lo na coluna `.val` em duas linhas (`+4,6%` 15 px mono 600 em cima, `+17.000 · 388 mil no total` 12 px embaixo) ou como rótulo fora do fim da barra (`left:calc(50% + w%)`). Manter o símbolo ▲/▼/＝ dentro da barra só se a barra tiver ≥ 20 px; senão colocá-lo ao lado do número. Nenhuma informação pode depender de largura de barra.

### 4. CORRIGE: "poucos vídeos" tem marca fraca demais (contraste gráfico)
- Tela: Referências, linha "Primeira Viagem (canal novo)", os dois temas.
- Evidência: `ri.js` aplica `opacity:.55` em `.mk` com `--mk`. Calculei o composto contra `--surface`: claro ≈ 2,1:1 (`#1B78BA` a 55 % sobre `#FBF7F0`), escuro ≈ 2,9:1; ambos abaixo de 3:1 para elemento gráfico que carrega significado. Visível na captura 390 (marca azul-acinzentada quase sumida).
- Correção: remover a opacidade; usar `--mk` cheio (6,80:1 escuro, 4,43:1 claro) e distinguir "provisório" pelo trilho tracejado/`.pill.pont` que já existe, ou por marca vazada (contorno 2 px em `--mk`, sem preenchimento), que já difere por forma.

### 5. CORRIGE: ri.css redefine componentes da tela 16 em vez de reusar (consistência)
- Evidência: `ri.css` redefine `.btn` (peso 400, `padding:0 11px`, `min-height:34px`) enquanto `a4.css:91` `.btn` é `font:500 13px`, `padding:0 13px`; `.sec` (a4: cartão com borda, padding 14/16) é reaproveitado e ainda recebe `.res` (cartão) e `ol.lst` (cartão): **3 caixas com borda aninhadas** (visível nas capturas); `.res` redefinido como cartão enquanto em `a4.css:152` é texto simples; `.pop2` (bloco inline que abre embaixo) é um terceiro padrão de "como é calculado", e a tela 16 usa `.pop` (popover ancorado, `a4.css:141`); `.sub` e `.val` com nomes genéricos podem colidir com `.chead .sub`. Valores soltos: `font:600 26px` (h1) e `600 20px` (h2) em vez do `.ch-shell`/`.sec h2` da tela 16; `gap:6px 14px`, `padding:10px 14px`, `height:22/26px`.
- Correção: usar `.btn` e `.pop` da tela 16 sem sobrescrever; tirar a borda de `.res` e `ol.lst` (deixar só o `.sec` como cartão; `.res` vira o `.pn-h .res`/`.lead` existente); prefixar o que for novo (`.ri-reg`, `.ri-dv`, `.ri-val`). Declarar a divergência se `.pop2` ficar.

### 6. CORRIGE: cor do estado "não medido" diz duas coisas
- Evidência: na régua, "ainda não coletado" e "sem vídeos em 90 dias" usam hachura rosa (`.reg.nmx`), mas "ainda não coletado" tem pílula cinza tracejada (`.pill.pont`) e "sem vídeos" pílula rosa (`.pill.nm2`). A mesma linha fala rosa na régua e cinza na pílula. Além disso a faixa rosa de 518 px (2 linhas) é o bloco mais chamativo da lista: mais destaque que a mediana mais alta.
- Medidas da hachura rosa (que o pedido citou): texto `--nm` sobre `--nm-bg` 6,77:1 escuro / 6,37:1 claro; sobre a faixa mais clara do fio composto 5,13:1 / 5,49:1; borda `--nm-line` sobre `--surface` 4,09:1 / 4,57:1 (≥3:1). A hachura passa; o problema é de significado e de peso.
- Correção: usar `.pill.nm2` nos dois casos e reduzir `.reg.nmx` a 28 px de largura ou colocar a pílula dentro da faixa e deixar `.val` vazio; cor rosa só para "não medido" (inclusive "ainda não coletado").

### 7. SUGESTÃO: falta a moldura da tela 16 (navegação, migalhas, título)
- A tela 16 usa `.ch-side` + `.ch-shell` + `.ch-tabs`; aqui há só um `h1 "Canais"` e a faixa de estados pontilhada. Fica sem a barra lateral, então a página nova parece solta e a "linha do mesmo componente" não é comparável. Também não existem ainda estados de erro, só-leitura e carregamento (NOTAS 7): esqueleto com 64 px de altura por linha (altura medida de `.lst>li` no desktop) para a página não pular.

### 8. SUGESTÃO: densidade em 390 e valores
- 390: a tela cheia tem 6.695 px de altura; cada linha tem 117 px (nome, régua 22, valor). Dá para juntar régua e valor na mesma linha de 64 px (valor à direita da régua, nome acima) e economizar ~40 %.
- `cmp()` mistura casas: "88,0 mil", "76,0 mil", "9,2 mil", "1,2 mi" ao lado de "812 mil", "270 mil". O ",0" é ruído e coluna à direita com unidades diferentes (mil/mi) não se compara na vertical. Usar sempre a mesma unidade na lista (mil) com separador de milhar ("1.180 mil") ou tirar o ",0".
- Botões de ordenar a 34 px em desktop (igual à tela 16; AA passa), 44 px em 390.

## Tabela de medidas

| Item | Escuro | Claro | Regra | Resultado |
|---|---|---|---|---|
| texto `--text` / `--surface` | 14,48 | 15,76 | 4,5 | ok |
| `--muted` / `--surface` | 6,18 | 7,13 | 4,5 | ok |
| `--dim` (eixo, contornos) / `--surface` | 4,86 | 5,59 | 3 | ok |
| `--dir-up` / `--dir-dn` / `--dir-eq` como texto | 7,26 / 7,71 / 6,18 | 6,37 / 5,55 / 7,13 | 4,5 | ok |
| texto `--on-lado` sobre barra up / dn / eq | 8,13 / 8,62 / 6,92 | 6,81 / 5,93 / 7,62 | 4,5 | ok (se couber) |
| marca `--mk` / surface | 6,80 | 4,43 | 3 | ok |
| marca `--mk` / faixa composta | 4,04 | 3,32 | 3 | ok, margem curta no claro |
| faixa composta / surface (preenchimento) | 1,68 | 1,33 | borda cobre | borda `--band-line` 6,80 / 4,43 ok |
| trilho `--border-strong` / surface | 1,44 | 1,77 | 3 (se carrega significado) | só orienta; a marca carrega o dado; ok |
| marca `.pt` com opacity .55 (calculado) | ≈2,9 | ≈2,1 | 3 | **falha (achado 4)** |
| hachura: `--nm` / fundo, / fio | 6,77 / 5,13 | 6,37 / 5,49 | 4,5 | ok |
| hachura: `--nm-line` / surface | 4,09 | 4,57 | 3 | ok |
| fonte mínima em texto de leitura | 12 px | 12 px | 12 | ok (nenhum <12) |
| alvo `.btn`, `.ibtn` desktop | 34 e 44 px | idem | 44 | `.btn` 34 px (padrão da tela 16) |
| alvo `.btn`, `.ibtn` 390 | 44 e 44 | idem | 44 | ok |
| `.ri` / `.reg` / `.dv` a 1440 como está | 169 / 11 / 11 px | idem | - | **quebrado (achado 1)** |
| `.ri` / `.reg` / `.dv` a 1440 simulado | 1100 / 518 / 518 | idem | - | ok |
| altura da linha `li` | 64 px (desktop), 117 px (390) | idem | - | ok / alto |
| barras com % cortado | 8/22 (1440 sim.), 12/22 (901 e 390) | idem | 0 | **falha (achado 3)** |
| rolagem horizontal | nenhuma em 1440/390 | idem | nenhuma | ok |
| nomes truncados (lista longa) | com reticências + `title` | idem | decidido | ok |
| posições reais dos ticks na log | 2,9 / 32,3 / 61,7 / 91,1 % | idem | rótulos em 0/33/67/100 % | **falha (achado 2)** |

## Não verifiquei
Opera de verdade (só Chromium), leitor de tela (conferi só `aria-label`/`aria-expanded`), aparelho real, rede lenta e fontes do Google (a captura pode ter caído em fallback; as fontes não alteram o achado 1), estado de erro (não existe no mockup), `?tema=claro` aplicado por JS depois do primeiro desenho (sem flash visível no headless). Para o Logan: o limite de 90 dias e as palavras "Constante / Variável / Irregular", "o maior ganho %" (frase truncada) e "não dá para medir" no resumo misturando 3 motivos.

---

## Re-revisão v2

**Veredito: aprova com consertos menores.** Playwright/Chromium sobre `file://`, 1440, 1101, 901 e 390, nos dois temas, 9 estados (cheio, magro, vazio, carregando, lento, erro, parcial, antigo, restrito) em 1440 claro/escuro, 390 claro/escuro e 901 claro. Capturas: `shots/naksu-v2-*.png`. Sem erro de console, sem rolagem horizontal em nenhum par, 0 texto de leitura abaixo de 12 px.

| Achado anterior | Medida agora | Resultado |
|---|---|---|
| 1 grade | `.ri` / li / régua: 1440 = 1100 / 1026 / 508; 1101 = 1100 / 1026 / 508; 901 = 901 / 827 / 369; 390 = 390 / 340 / 214 | resolvido |
| 2 escala log | rótulos medidos a 2,9 / 32,3 / 61,7 / 91,1 % da régua nos 4 larguras; `.ri-esc>div` tem a mesma largura e x da `.reg` (offset 0); ticks de 1 px nas mesmas posições; cabeçalho sticky | resolvido |
| 3 % cortada | 0 de 18 barras com texto (a % está em `.ri-val`); 0 elementos com overflow oculto cortando conteúdo | resolvido |
| 4 "poucos vídeos" | opacity 1; marca vazada 8 x 20 px, borda 2 px `--mk` sobre `--surface`: 6,80:1 escuro, 4,43:1 claro (>=3) | resolvido |
| 5 reuso | `.btn` sem redefinição (padding 0 13px, peso 600 só em `aria-pressed`); 2 cartões `.sec`, sem `.res`/lista com borda aninhada; `.pop` da tela 16; classes novas com prefixo `ri-`/`reg`/`dv` | resolvido |
| 6 "sem medida" | em todos os estados só 3 variantes de pílula: `.nm2` (sem medida, rosa hachurado, todos os motivos, inclusive "ainda não coletado"), `.pont` (provisória/restrito, cinza tracejado), `.err` (falhou). Texto `.pont` 6,18 / 7,13; `.err` 5,59 / 6,16; bordas >= 4,86 | resolvido |
| color-mix() | 0 usos em CSS/JS executável (as 4 ocorrências são texto de comentário "Sem color-mix()") | ok |
| 7 e 8 | moldura mínima declarada; esqueleto 48 blocos; 390 cheio = 1.733 px (antes 6.695); unidade única "mil" | resolvido |

Estados novos (carregando, lento, erro, parcial, antigo, restrito): existem e se distinguem por texto, ícone ⚠ e borda (erro: borda sólida `--danger-text`; lento/antigo: tracejada), não só por cor. 1440 e 901 usam a mesma altura (esqueleto 1.240 px, sem pulo).

### Consertos menores (não bloqueiam; sem rodada extra)
1. **Alvo de toque das abas a 390 px:** `.ri-abas .btn{min-height:40px}` (ri.css, duas vezes dentro do `@media(max-width:899px)`). Trocar por 44 px e subir `.ri-abas` e `--stk` de 52 para 56 px (a régua `--stk` mantém o cabeçalho sticky logo abaixo das abas). O `.ri-estl .btn` (36 px) é só painel do mockup.
2. **Glifos de faixa pequenos:** o "≈" de "faixa larga" e o "=" de "faixa estreita" no `.ri-val small` (12 px) aparecem como ponto/traço quase invisível na captura 1440 claro; o texto "faixa larga" já carrega o significado, então é só calibrar: usar glifo em 14 px ou ícone SVG de 14 px como na pílula `.err`.
3. **Botões de ordenar a 34 px no desktop:** herdado da tela 16 (`.btn`); fica declarado como divergência da meta de 44 px, igual à tela 16.

Não verifiquei: Opera, leitor de tela, aparelho real, rede lenta, fontes do Google (fallback possível).
