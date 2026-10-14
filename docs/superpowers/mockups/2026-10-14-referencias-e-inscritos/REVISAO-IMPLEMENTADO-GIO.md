# R7 · Parecer do Gio (QA) sobre Canais · Referências e Inscritos implementado

Veredito: **VOLTA PARA CONSERTO** (3 achados "corrige", 2 menores). Nada bloqueia o que está sólido, mas há divergência não declarada.

## Ambiente
- Worktree wt-ri, HEAD 3ea081774 + cb1a31b60 (só o spec R6). App em `next dev --webpack -p 3099` (o Turbopack recusa o `node_modules` por symlink da worktree; o dev em webpack é só do teste, não muda o resultado de tela). Supabase local 54321/54322, sem `db:reset`. Credenciais falsas de SES/Turnstile do runbook. Relógio fixo do projeto: 24/10/2026 15:02. Dado 100% sintético (semente `riCenario`, 11 canais; +14 canais sintéticos só no teste de desempenho).
- Spec R6 `canais-ri.spec.ts`: estava 1 vermelho por **spec velho** (esperava "poucos vídeos (0)" e "retrato faltando em"; o commit 3ea081774 do Logan trocou para "só vídeos com menos de 7 dias" e "falta a contagem de"). Consertei o spec (cb1a31b60). Agora 12/12 verdes (uma rodada; não rodei três seguidas).
- Servidor e navegador encerrados; nada ficou rodando. A porta 3333 já tinha uma API de outro terminal: não toquei nela.
- Capturas em `shots-implementado/` (95 arquivos, só dado sintético). Os recortes de elemento mostram às vezes o título sob a barra do CMS: é efeito da captura, mas ver achado 2.

## O que está sólido
- Régua: ticks de linha (0/50/100%) e rótulos "10 mil / 100 mil / 1 mi" coincidem; marca e faixa na posição logarítmica certa (60 mil = 38,9%, conferido pela conta). Marca vazada e trilho tracejado da provisória presentes. Faixa/marca alinhadas a 1440, 1101, 901 e 390.
- Números: nenhum decimal solto em nenhum estado/largura ("577,5" não aparece); `aria-label` das réguas em inteiros ("60.000 views... entre 55.750 e 65.000"); sem `undefined`/`NaN`/`null`/`Infinity` em texto ou aria. Contagens da frase batem (3 medidos + 1 provisória + 7 sem medida = 11).
- Barra com texto cortado: zero elementos com overflow oculto vazando em 4 larguras x 2 temas x 4 estados. Nome com 120+ caracteres, emoji, aspas, `<script>` e `<b>`: reticências + `title`, sem XSS (`window.__xss` nulo), sem rolagem lateral, também a 390.
- Contraste (medido por canvas, pior caso do hachurado): `nm2` texto 6,14 (escuro) e 6,37 (claro), borda 3,23 e 3,94; `pont` texto 6,18/7,13, borda 4,86/5,59. Todos acima de 4,5 e 3.
- Teclado: Tab percorre ⓘ, ordenar, ordenar, "Ver todos", ⓘ, ordenar (anel laranja 2 px visível); Enter e Espaço ordenam e o foco fica no botão; `aria-live` anuncia "Referências ordenadas por ..."; ⓘ abre com Enter, `aria-expanded` acompanha, Esc fecha e devolve o foco ao ⓘ; clique fora fecha. Duplo e triplo clique frenético: estado final coerente, URL `ordr=` coerente. `?ordr=zzz&ordi=%00<x>&aba=%27` cai no padrão.
- Estados: **cheio**, **magro** (5 canais), **vazio** (nicho sem canal: as duas frases do R.2), **antigo** (aviso "Mostrando os dados de 21/10, 14:02 (última coleta há 3 dias). Ordenar continua funcionando." e linhas ainda medidas) e **parcial real** (video_limit cheio) conferidos. A janela parcial traz data real: "provisória · só desde 14/09" (40 dias antes do relógio = o vídeo mais antigo acompanhado) e "sem medida · só desde 19/10" (5 dias), e as duas contas conferem.
- Rede: nenhum 4xx/5xx de código da tela e nenhum `color-mix()` nas regras que casam com elementos das duas seções (o `layout.css` global tem 1.353, mas nenhum selector alcança Referências/Inscritos).
- (a) Pé preso: **pronto.** O `.cn-pin` nunca fica por cima de Referências/Inscritos, a 1440 nem a 390 (sobreposição 0 px em 8 posições de rolagem; ele some ou sai de cima antes das seções).
- (b) Ordenar, a 25 canais, até a lista mudar (dev, sem Profiler do React; relógio da página): 15 a 16 ms a 1x de CPU (11 canais: 15 a 20 ms); a 4x de CPU 18 a 20 ms e picos de 56 a 58 ms. Abaixo de 50 ms no caso normal, **sem `memo`** necessário; no pior caso emulado (4x) passa um pouco de 50 ms em build de desenvolvimento. Não tirei o gráfico do Profiler: medi pelo relógio.
- Troca de aba a 390: 16 ms até a seção aparecer; aba lembrada na URL (`aba=ins`) e depois do reload.

## Achados
### 1. CORRIGE · "Ver todos os N" aparece a 1440, 1101 e 901 e não faz nada · dono: Naksu/Yannis
- Passos: abrir `/cms/youtube/competitors?niche=ri-cenario` a 1440. Embaixo de Referências e de Inscritos há o botão "Ver todos os 11", com as 11 linhas já visíveis (mockup: só no celular).
- Esperado: oculto a partir de 900 px (ri.css:63 `.ri .ri-more{display:none}`). Obtido: `display:inline-flex`. Reproduziu 100% (todas as combinações de largura >= 900, nos dois temas).
- Evidência: a regra `[data-obs-screen="canais"] .btn{...inline-flex}` (page.css) e `[data-cms-section="youtube"] .btn` empatam em especificidade com `.ri .ri-more` e vencem pela ordem. Linha provável: `_canais/ri.css:63` (subir especificidade, ex.: `.ri .btn.ri-more`) e a linha 80 do mesmo arquivo. Captura: `cheio-1440-dark-ref.png`.
- Teste que falta: no spec R6 (`canais-ri.spec.ts`), a 1440, `expect(getByRole('button', { name: /^Ver todos os \d+$/ })).toBeHidden()` nas duas seções. Hoje o spec só olha abaixo de 900 px.

### 2. CORRIGE · Régua grudada (1440 e 390) e abas grudadas (390) ficam por baixo da barra do CMS · dono: Naksu/Yannis
- Passos: a 390, abrir a tela, clicar em Referências, rolar o `main` (o rolador é o `<main class="overflow-y-auto">`, não a janela) até o meio da lista. Repetir a 1440.
- Esperado: abas (56 px) visíveis logo abaixo da barra; a régua com a escala visível abaixo delas (ou, a 1440, abaixo da barra). Obtido: `.ri-abas` em top 0..56 e `elementFromPoint` devolve `HEADER.cms-topbar` (sticky, 48 px a 390, 52 px a 1440, z-index 40): só ~8 px das abas aparecem, e a escala "10 mil / 100 mil / 1 mi" a 1440 fica em top 0..23, também coberta. A régua fica abaixo das abas a 390 (escTop 56 = abasBottom 56, ordem correta), mas as duas por baixo da barra do CMS.
- Causa provável (evidência: `getPropertyValue('--obs-topbar-h')` vazio em `.ri`): `--obs-topbar-h` só é definida em `_canal/canal.css:8` (52px), não em `ri.css`; `.ri{--stk:var(--obs-topbar-h,0px)}`, `.ri-abas{top:var(--obs-topbar-h,0px)}` caem em 0. Linhas: `_canais/ri.css:5`, `:11`, `:70`, `:71`. Reproduziu 4/4 (2 temas x 2 larguras). Capturas: `regua-grudada-390-dark.png`, `regua-grudada-1440-dark.png`, `abas-grudadas-390-dark.png`.
- Teste que falta: a 390 e a 1440, depois de rolar o `main` 500 px dentro da lista, `elementFromPoint` no centro de `.ri-abas` (390) e de `.ri-esc` está dentro do próprio elemento (nunca `.cms-topbar`). É spec de navegador (depende de layout/sticky).

### 3. CORRIGE · "Sem conexão." do estado antigo não existe · dono: Yannis
- Plano R.2 (M3 do Logan): aviso de coleta velha leva "Sem conexão. " só com `navigator.onLine === false`. Passos: semear coleta de 3 dias, abrir a tela, `context.setOffline(true)`, clicar em "Faixa mais estreita". Obtido: texto idêntico ao online. `grep "Sem conexão"` em `_canais/` não acha nada: `avisoDe` (ri-model.ts:326) é puro e o componente `Aviso` (ri-secoes.tsx:43) não lê `navigator.onLine`. Reproduziu 1/1 (determinístico; é ausência de código). Se a decisão for cortar o M3, declarar o desvio no plano; senão implementar no componente (cliente) e testar em jsdom com `navigator.onLine` falso.

### 4. MENOR · A linha de valor quebra em 3 linhas a 1440 (divergência do mockup) · dono: Naksu
- `.ri-val small` herda a fonte mono 12 px do `.ri-val` (ri.css:~51); no mockup é sem serifa e cabe em uma linha: "= faixa estreita · 1,2× · 6\nvídeos". A pílula "provisória · só desde 14/09" também quebra em 2 linhas. Chip "seu canal" é neutro (mockup: laranja). Declarar ou alinhar.

### 5. MENOR · Seed puxa imagem externa e dá 404 no console · dono: Gio
- A semente usa `video_id` falso (`xxrilarga11`...) e o navegador pede `https://i.ytimg.com/vi/xxrilarga11/mqdefault.jpg` (404) ~1,5 s depois do load, ruído de console que o spec R6 não pega porque termina antes. Não é código da tela. Ação: o spec R6 deve interceptar `i.ytimg.com` (route.abort/fulfill) para não depender de rede e para o "sem erro de console" valer.

## Para o Logan / a Naksu
- Logan: "sem medida · só desde 19/10" (TEXTO-A-REVISAR em ri-model.ts:28) lê estranho ao lado de "só vídeos com menos de 7 dias"; "Nenhum canal acompanhado ainda. Adicione canais em Canais..." fala "Canais" estando em Canais; "mediana" aparece no ⓘ (esperado).
- Naksu: bordas dos botões de ordenar e do chip "seu canal" com 1,37 a 1,77:1 (não-texto <3:1, herdado de `.btn`).

## Matriz (passou / falhou / não testado)
| Cenário | 1440 e 1101 | 901 | 390 |
|---|---|---|---|
| cheio, escuro e claro | passou (menos achados 1, 2, 4) | passou (menos achado 1) | passou (menos achado 2) |
| magro (5 canais) | passou | passou | passou |
| vazio (R.2) | passou (1440 e claro) | passou | passou |
| antigo (aviso, linhas medidas) | passou; "Sem conexão." falhou (3) | passou | passou |
| parcial real (video_limit cheio) | passou (1440 e 390; datas conferem) | não testado | passou |
| erro por seção | **não testado** | - | - |
| nomes longos/emoji/HTML | passou | passou | passou |
| teclado, ⓘ, Esc, aria | passou | - | Esc/Enter só a 1440 |
| pé preso | passou | - | passou |
| ordenar < 50 ms a 25 canais | passou a 1x; ~58 ms a 4x (dev) | - | - |
| 1101 antigo/vazio | passou | - | - |

## O que NÃO conferi
- **Estado `erro`** (seção que lança): não há dado que o provoque sem mexer no código de produto. Coberto só pelos testes de unidade da R3/R5; falta spec que force exceção (por exemplo mock de `buildRiView` em teste de componente já existe; no navegador, não).
- **Opera** (inclusive `color-mix()`; no CSS carregado das seções não há, mas tokens herdados não foram resolvidos um a um), leitor de tela de verdade (só `aria-label`, `aria-live` e `aria-expanded` pelo DOM), rede lenta real, tema do sistema, produção logada.
- Profiler do React (usei tempo de relógio até a lista mudar); build de produção (rodei `next dev --webpack`); três rodadas seguidas do spec R6 (rodei uma).
- A 1101/901 só os estados cheio e antigo (vazio/magro a 901 e 1101 foram capturados mas só li o texto).
- Roteiro para o dono no Opera, depois do conserto: abrir Canais num nicho com mais de 10 canais, a 390 (janela estreita ou celular), rolar a lista de Referências: as abas "Referências | Inscritos" têm de ficar visíveis logo abaixo da barra, com a escala de mil/mi abaixo delas; a 1440, rolar: a escala não pode sumir sob a barra; abaixo de 900 px "Ver todos os N" aparece, acima não.

## Reconferência (HEAD 0a6aceee1)
Veredito: **PRONTO** para a R7. Ambiente: wt-ri, `next dev --webpack -p 3099` subido por mim com o relógio do playwright.config (OBS_E2E=1, OBS_NOW_OVERRIDE 24/10 15:02), Supabase 54321, SES/Turnstile falsos. Capturas em `shots-implementado/reconferencia/`. A sonda (spec temporário) não foi commitada nem fica na árvore.
1. "Ver todos os N": visíveis = 0 a 1440, 1101 e 901; a 390 aparece nas duas abas e o clique passa de 10 para 11 linhas. **Passou.**
2. Régua e abas grudadas (`elementFromPoint` em 3 posições de rolagem): a 390, abas em top 52 (a topbar acaba em 48) e a escala em 108, ambas na própria elemento, sem sobreposição; a 1440, a escala trava em 52 = base da topbar. **Passou.** Menor, para a Naksu: sobram 4 px entre a topbar (48) e as abas a 390, e o texto da página aparece nessa fresta (`grudado-390.png`).
3. `setOffline(true)`: "Sem conexão. Mostrando os dados de 21/10, 15:02 (última coleta há 3 dias). Ordenar continua funcionando." antes e depois de ordenar; ao voltar online o prefixo some. **Passou.** Cuidado de teste: abrir sem `fmt=` faz a tela dar `router.replace` para `&fmt=longos`; se o offline cair antes, a navegação falha e a página vira `chrome-error` (artefato do spec, não do conserto). O teste espera a URL ter `fmt=`.
4. `.ri-val small` a 1440: fonte sem serifa, 1 linha nos rótulos de faixa/provisória; no máximo 2 linhas e só nas frases longas de Inscritos (a de "+30.000 · 1,42 mi no total · de 26/09 a 24/10", "contagem oculta", "faltam 18 dias"). Nenhuma com 3. **Passou.**
5. Janela parcial (video_limit = nº de vídeos, vídeos antigos trazidos para 40 dias, mais um vídeo agendado a +5 dias no vídeo mais antigo de um canal parcial): rótulos "só desde 09/09" e "só desde 14/09"; nenhuma data depois de 24/10, a 1440 e a 390; o vídeo futuro saiu da conta (mediana da Faixa Larga caiu de 54 mil para 33,3 mil, coerente). **Passou.**
6. Spec R6 `canais-ri.spec.ts`: 3 rodadas seguidas, 18/18 verdes em cada (1,8 / ~2 / 2,0 min), sem retry. **Passou.**
Não conferi de novo: Opera, build de produção, estado `erro` (continua sem spec de navegador).
