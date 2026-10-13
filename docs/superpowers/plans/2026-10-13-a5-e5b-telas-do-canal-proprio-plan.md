# A5, ordem 19: E5, parte B: telas do canal e do vídeo próprios com os dados novos (plano de implementação)

Escrito em 13/10/2026. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md` (7.2 retenção, 7.3 dimensões e origem) e `04-medidas-telas-e-mockups.md` (6.1 regras de tela, 6.5 mockups). Mockups aprovados pelo dono em 13/10/2026: **11b** (`docs/superpowers/mockups/2026-10-13-a5-lote-2/11b-retencao-janela-e-faixa/`), **12** (`…/2026-10-13-a5-lote-2/12-origem-das-views/`), e do lote 1 (`docs/superpowers/mockups/2026-10-13-a5-lote-1/`, decisão 62) as telas **A "ainda cedo"** e **B "% assistido por período"**. Levantamento de fatos: `.superpowers/sdd/a5-planos-onda-2/e5b-telas-do-canal-proprio/fatos.md`. **Migration: nenhuma.**

**Objetivo, em três frases.** Fazer a página do vídeo próprio e a página do canal próprio mostrarem o que as etapas E8 e E11 passaram a guardar: a curva de retenção em três janelas com a comparação do YouTube (11b) e de onde vêm as views, por origem, termos, sites, aparelho, país e inscritos (12), mais as duas telas do lote 1 que ainda não viraram código (A e B). Cada tela segue o mockup aprovado ao pé da letra, com os mesmos textos; onde o mockup, o spec e o código divergem, a divergência está na seção 1 como pergunta ao dono, com o padrão já assumido. Nenhuma tela inventa número: durante as primeiras semanas quase tudo lê "não medido" com o motivo e a data, e a seção 7 diz o que cada tela mostra nesse período.

**Fica FORA deste plano.**
- **A tela da curva do mockup 6** (só vida inteira, cinco estados): é a Tarefa 13 do plano `docs/superpowers/plans/2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md`. Este plano **não a duplica**: parte dela e acrescenta o que o 11b tem a mais. A divisão exata está em 0.2.
- **As coletas** (passos "retenção", "dimensões", "normalizadores") e as migrations MG14, MG5, MG7 e MG11: são dos planos da E8, da E11 e do passo 0 da E17. A única linha de coleta que este plano toca é a regra das janelas de 7 e 30 dias com resposta vazia (Tarefa 3), e só com a resposta **explícita** do dono à pergunta 1 *(emenda 1: D-I7)*.
- **As telas C, D e E do lote 1** (canal de concorrente em erro, atraso da leitura por hora, fila "Saíram do YouTube"): outras trilhas.
- **País por mês, direção por origem e taxa de clique por origem:** o dono tirou os três ao aprovar o 12 (`APROVACOES-DO-DONO.md`, última linha do 12). O desenho de "país por mês" atrás de `?pais=mes` no mockup não vira código.
- **Cowork e forja:** nenhuma rota nova em `apps/web/src/app/api/pipeline/`, nada em `lib/pipeline/api-registry.ts`, em `apps/web/data/pipeline-docs/` nem em `docs/cowork-*` (spec 7.2 e 7.3: "nenhum endpoint do Cowork nesta fase"). **Pipeline Integrity: não se aplica.**
- **O contorno tracejado verde-água e a marca "+ novo":** são sinal de mockup ("o que a proposta acrescenta"), não existem em produção. O mesmo vale para a barra "Estados do mockup", a marca "exemplo" e a tabela "A conta que fecha".
- As medidas M1 a M9 da E4, a direção e o estado dos canais: nenhuma das quatro telas as lê (fatos 4.13).

---

## Estado deste plano (13/10/2026)

Primeira versão, antes do portão dos dois especialistas (`revisor-engenharia-dados-senior` e `revisor-engenharia-software-senior`). **Emenda 1, de 13/10/2026:** resposta aos pareceres da rodada 1; cada trecho mudado traz a marca "(emenda 1: <achado>)", com `D-` para o parecer de dados e `S-` para o de software. A lista, achado por achado, está em `.superpowers/sdd/a5-planos-onda-2/e5b-telas-do-canal-proprio/resposta-r1.md`. Os 37 achados foram conferidos no código local e aceitos (dois em parte); nenhum foi recusado. **Emenda 2, de 13/10/2026:** resposta aos pareceres da rodada 2 (um importante e quatro menores de dados, sete menores de software); cada trecho traz "(emenda 2: <achado>)", com `D-` e `S-` como antes, e a lista está em `…/e5b-telas-do-canal-proprio/resposta-r2.md`. Os 12 foram conferidos no código local e aceitos (um em parte). Nada aqui foi executado: não rodei build, suíte, navegador nem consulta em produção. O que afirmo sobre o código vem de leitura do repositório local (HEAD cerca de 300 commits à frente de `origin/staging`); o que só produção responde está em 3.2 como conferência pendente, com o comando. Refiz à mão duas contas do levantamento, sobre as fixtures reais (seção 3.1, fatos F9 e F10).

**Nada das dependências está em produção.** Em 13/10 as tabelas `yt_own_video_retention`, `yt_own_video_coverage`, `yt_own_video_dim_daily`, `yt_own_video_traffic_detail_daily` e `yt_own_video_reach_dim_daily` existem só como SQL de ensaio (`.superpowers/sdd/a5-e6-e8/sql/mg5.sql`, `mg14.sql`; `.superpowers/sdd/a5-e11/sql/mg7.sql`); os leitores `lerRetencao`, `lerDimensoes` e `lerDetalheDaOrigem` existem só local e nenhuma página os chama; a A4 (dona de quase todo arquivo de tela que este plano edita) ainda não está em `staging`; o token `LeituraPrivadaDoSite` do passo 0 da E17 ainda não existe no HEAD (`ls apps/web/src/lib/youtube/observatorio/proprio/leitura-privada.ts`: não há).

## O que pode começar JÁ

Não esperam migration, A4 em `staging`, nem resposta do dono: as Tarefas **1, 2, 7, 8 e 14** e a regra pura da **13** (`cedo.ts`), que são módulos puros novos com teste de unidade, e a **Tarefa 0** (congelar os mockups e rodar as conferências). Esperam a A4 em `staging` (arquivos dela): 6, 11, 12, 13 (o bloco de impressões), 15, 16, 17, 18. Esperam a Tarefa 13 do plano da E8 feita: 5 e 6. Esperam o lote C aplicado em produção e conferido para **ir a push** (regra 1 da reconciliação): 4, 9, 16 (passos da retenção e da origem), 17, 18. *(emenda 1: D-I7)* A Tarefa 3 espera a resposta explícita do dono à pergunta 1; no silêncio, não roda. *(emenda 1: D-I2)* O lote E5b-B espera também a MG14 aplicada e o lote E6-P2 (leitor tolerante) em `main`.

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa do que já existe (conferido no código local em 13/10)

| O que | Onde | O que este plano usa, e o que **não** tem |
|---|---|---|
| Leitor da retenção | `apps/web/src/lib/youtube/observatorio/proprio/ler-retencao.ts` (`lerRetencao`, commits `524284b3`, `31c57af6`) | `curvas` (a mais recente por janela, com pontos), `leituras` (sem pontos), `tabelaAusente`, `janelasIlegiveis`, `descartados`. **Não tem:** os pontos de outras leituras de `vida`; as tentativas de `retencao_7d` e `retencao_30d` (consulta só `kind = 'retencao_vida'`, linha 208 do arquivo). A Tarefa 4 acrescenta. |
| Modelo puro da curva | `…/proprio/retencao-curva.ts` (`lerCurva`) | `meio`, `saidas`, `revistos`, `pico`, `completa`. `relativa` devolve **só a categoria**, pela mediana **não arredondada** com cortes 0,45 e 0,55. **Não devolve o número.** A Tarefa 2 acrescenta. |
| Regra da coleta | `apps/web/src/lib/youtube/coleta/retencao-regra.ts` | `Janela`, `RETENCAO_JANELAS_DESDE = '2026-10-13'`, `RETENCAO.videoNovoDias = 5`, `RETENCAO.janelaDesisteDias = 45`, fim de janela = publicação + 6 e + 29 (último dia **incluído**). |
| Leitores das dimensões | `…/proprio/ler-dimensoes.ts` (`lerDimensoes`, `lerDetalheDaOrigem`) | por vídeo e dia: `coberto`, `baseMedida`, `antesDoInicio`, `desde`, `linhas`, `base`; `EstadoConjunto` por conjunto. Limites: `JANELA_MAX_DIAS = 120` (lança acima), `TETO_VIDEOS_DIMENSOES = 50`, `TETO_LINHAS_PADRAO = 100_000` (lança acima). |
| Modelo dos estados | `…/proprio/dimensoes-estado.ts` | `estadoDoDia` (`valor`, `zero_medido`, `zero_ou_abaixo_do_limiar`, `em_revisao`, `nao_medido`), `classificarConjunto` (`schema_ausente`, `passo_desligado`, `coleta_em_erro`, `nao_coletado`, `coletado`). **Não tem:** "ainda não existe", "carregando", "erro de leitura", nem estado por **bloco** (os dele são por dia e por conjunto). A Tarefa 8 deriva. |
| Catálogo de códigos | `apps/web/src/lib/youtube/reporting/codigos.ts` (`ORIGEM_LOTE`, `APARELHO_LOTE`, `ORIGEM_DE_BUSCA = '5'`, `ORIGEM_EXTERNA = '9'`) | rótulo por código. **Não tem** os seis grupos do mockup 12, os cinco de aparelho, nem nome de país. A Tarefa 7 cria. |
| Datas da coleta | `apps/web/src/lib/youtube/coleta/e11-config.ts` | `DIMENSOES_DESDE = '2026-10-10'`, `DIMENSOES_LIGADO_EM = '2026-10-20'` (**previsões**, confirmadas no commit do envio da E11), `LOTE_DESDE = '2026-09-08'`. |
| Entrada do dado privado | `apps/web/src/app/cms/(authed)/youtube/competitors/_proprio/dados.ts` | `podeVerPrivado`, `lerDadosDoCanal`, `lerDadosDoVideo`. Único módulo fora de `lib/…/proprio/` que pede a prova e chama leitores (a varredura `test/youtube/observatorio/proprio-varredura.test.ts` garante). |
| Alcance por dia | `…/proprio/dias.ts` (`montarDias`, `videoNovo`, `DIAS_DE_VIDA_MIN = 3`, `DIAS_RECENTES = 2`) | a tela A usa `montarDias` para separar "zero medido" de "o dia ainda não chegou". |
| % assistido | `…/proprio/assistido.ts` (`JANELA_ASSISTIDO_DIAS = 28`, `POUCAS_VIEWS = 10`, `NA_MEDIA_PONTOS = 2`, `medianaDe`, `faixaDaDuracao`, `normalDaFaixa`, `normalDoCanal`, `contraNormal`) | a tela B reaproveita a mediana, as faixas e a régua de 2 pontos; **não** tem janela de 90 dias nem "canal inteiro". |
| Diário | `…/proprio/ler.ts` (`lerDiario`) | lê só 38 dias (`JANELA_DIARIO_DIAS + 10`) de até 50 vídeos. Não comporta 90 dias nem "canal inteiro": a Tarefa 9 cria um leitor novo, sem editar este arquivo. |

### 0.2 O que fica em cada plano: Tarefa 13 da E8 e este plano

| Peça | Tarefa 13 do plano da E8 (mockup 6) | Este plano (mockup 11b) |
|---|---|---|
| `lerDadosDoVideo` passa a ler a retenção; falha só na retenção vira `{ acesso: 'erro' }` | faz | usa |
| `_proprio/retencao-curva-model.ts` com os cinco estados da vida inteira | faz | a Tarefa 5 cria `curva-janelas-model.ts`, que importa as funções de frase dela e acrescenta as três janelas |
| `_proprio/retencao-curva.tsx` e `.css` (SVG da curva) | faz, com o eixo cortado em 120% | a Tarefa 6 muda o eixo (pergunta 2) e acrescenta a primeira leitura tracejada |
| `header-model.ts`, célula `retencao` do canal | faz | não toca |
| `lib/conferencias.ts`: `E8_TELA_DEPLOY` e `e8-tela-dado-real` (item 64) | faz | não toca; a Tarefa 19 acrescenta o bloco próprio |
| Seletor de janela, faixa do YouTube, "como a curva mudou", "ver as N leituras", cartões de 7 e 30 dias, poucas views, só leitura com cadeado | **fora** ("esperando desenho") | faz |

Se a Tarefa 13 da E8 ainda não tiver sido executada no dia em que a Tarefa 5 daqui começar, o controlador a despacha primeiro. As duas podem ir no mesmo envio; nesse caso o portão de UX que vale para o envio é o do 11b (o 11b contém o bloco do mockup 6).

### 0.3 Avisos de topo

- **Aviso ao controlador sobre o plano da E17 (não edito arquivo de outra etapa).** A Tarefa 6 do passo 0 da E17 troca o token dos três leitores de `EdicaoDoSite` para `LeituraPrivadaDoSite`, inclusive em `lerDetalheDaOrigem`. Isso daria termos de pesquisa e sites a quem tem só o direito de ver, contra o que o dono aprovou no mockup 12 ("só leitura sem termos nem sites"). A Tarefa 9 deste plano mantém termos e sites atrás da prova de **edição**, e funciona nas duas ordens (antes ou depois da Tarefa 6 de lá). *(emenda 1: S-I9)* O desenho é **um só**: a prova de edição dos termos mora só em `_proprio/dados-termos.ts`. Este plano **não** escreve `EdicaoDoSite` nem `edicaoValida` em `ler-dimensoes.ts`, porque a varredura da Tarefa 6 da E17 (linha 532 daquele plano: "nos três leitores e em `dados.ts`, citar `EdicaoDoSite` ou `edicaoValida` vira violação") ficaria vermelha; o ramo condicional da primeira versão saiu. O que o controlador leva ao plano da E17, em uma linha: `dados-termos.ts` entra em `PODE_PROVAR` e é o único chamador permitido de `lerDetalheDaOrigem`; a mudança de lá na mesma constante (`dados.ts` sai de `PODE_PROVAR`) e a daqui são seriais no mesmo arquivo de varredura, cada uma com o seu controle negativo.
- *(emenda 1: D-I2)* **Aviso ao controlador sobre o plano da E6 P3 (não edito arquivo de outra etapa).** O portão G1 daquele plano confere só `proprio/ler.ts`, e a lista de leitores do diário dele (F6) não tem `proprio/ler-diario-periodo.ts`, que nasce aqui (Tarefa 9). Se o lote E5b-B for a `main` antes da MG15, o G1 precisa incluir o leitor novo; se for depois, o teste "apaga as linhas de zero e afirma os mesmos números" da Tarefa 9 é o que segura.
- **Colisão de nomes.** "Retenção" já é a aba do canal que mostra o **% assistido** (`_proprio/retencao-model.ts`, `retencao.tsx`, `retencao.css`, perfil de semente `retencao`). A curva é outra coisa. Todo arquivo novo da curva começa por `curva-`; os da origem por `origem-`; os da tela A por `cedo-`; os da tela B por `assistido-periodo`.
- **Marca de contagem.** O mockup 12 usa uma função única `countRuleOf` "do spec 01". Ela **não existe** no código (`grep -rnE "countRuleOf|24/08|08-24" apps/web/src`: vazio). O que existe é `apps/web/src/lib/youtube/coleta/metric-version.ts`, que corta o diário privado em **27/08/2026**, e a restrição de `metric_version` da tabela em produção usa a mesma data. O mockup escreve 24/08/2026. É a pergunta 10.
- **Pasta dos mockups do lote 2 não rastreada.** `git status` mostra `?? docs/superpowers/mockups/2026-10-13-a5-lote-2/` (17 MB de capturas no 11b e 57 MB no 12). A Tarefa 0 commita as duas pastas sem `shots/` e guarda a cópia congelada.

---

## 1. Perguntas que só o dono responde

O plano segue com o padrão de cada linha. O padrão é o mockup, menos em duas: na pergunta 6, onde seguir o mockup entregaria número privado a quem não pode ver, e *(emenda 1: D-I7)* na pergunta 1, onde seguir o mockup exige reduzir a coleta e pode perder dado para sempre.

| # | Pergunta | Padrão assumido | O que trava |
|---|---|---|---|
| 1 | Janela de 7 ou 30 dias em que o YouTube respondeu vazio: o mockup diz "Esta janela é buscada uma vez só"; a coleta de hoje tenta de novo a cada 7 dias, até 45 dias depois de a janela fechar (`retencao-regra.ts`, linhas 205 a 215). Qual vale? | *(emenda 1: D-I7)* **A coleta fica como está e a frase é a alternativa:** "Tentamos de novo uma vez por semana, até 45 dias depois de a janela fechar." (texto novo, passa pelo revisor de UX). A Tarefa 3 só roda com a sua resposta **explícita** "seguir o mockup". O custo, em uma frase: seguir o mockup faz uma resposta vazia passageira (o relatório de retenção ainda não fechado no dia em que pedimos) virar "sem curva" para sempre naquela janela; manter a regra de hoje custa no máximo 2 chamadas por vídeo novo a cada 7 dias. Ninguém mediu se o relatório de retenção fica pronto no mesmo dia que o diário (a coleta usa o atraso do diário como sinal): a conferência C-16 mede no primeiro vídeo novo. Escolhi este padrão, contra a regra geral "o padrão é o mockup", porque é o que não perde dado nem afirma o que não foi medido. | Tarefa 3 e uma frase da Tarefa 5 |
| 2 | Eixo da curva: o mockup 6 corta em 120%; o 11b cresce até 140% quando a curva passa de 100%. | **11b** (mais novo, aprovado em 13/10). | um trecho da Tarefa 6 |
| 3 | O YouTube devolve a comparação com "vídeos de duração parecida" **por ponto do vídeo** (100 valores), e a tela mostra um número por leitura. Qual conta? | **Mediana dos pontos que trazem o valor, arredondada a duas casas, classificada pelo valor arredondado** (abaixo de 0,45: abaixo; acima de 0,55: acima; 0,45 e 0,55 são "na média"). É a conta que o código já faz, agora com o número e com o arredondamento do mockup. Com menos da metade dos pontos com valor: "Sem a comparação do YouTube". Os números medidos estão em 3.1, F9: a escolha entre mediana e média **muda o veredito** de um dos três vídeos medidos. | Tarefa 2 |
| 4 | Quantas views separam curva "serrilhada" (lida como indício, sem saídas nem trechos marcados) de curva "boa"? | **500 views da leitura, provisório**, com revisão marcada para 28 dias depois do envio (conferência C-6). O exemplo de 100 do mockup não vale. O motivo do 500 está em 3.1, F10. Leitura sem a contagem de views é tratada como poucas views, com a frase "Não sabemos quantas views esta leitura tinha: leia como indício." (frase nova, passa pelo revisor de UX). | uma constante da Tarefa 5 |
| 5 | Depois do passo 0 da E17, quem tem o direito de ver desempenho privado e **não edita** vê termos de pesquisa e sites? | **Não** (mockup 12 e a sua resposta de 13/10: "só leitura sem termos nem sites"). Termos e sites só para quem edita. | Tarefa 9 |
| 6 | Quem não edita **nem** tem o direito: o mockup 12 (variante "só o total") mostra o total de views do período, que vem do diário privado. | **Não mostra esse número.** Fica o aviso "Dado que você não vê", com os sete blocos nomeados, e "O total acima" passa a ser o total público do cabeçalho. É uma das duas linhas em que o padrão não é o mockup (a outra é a pergunta 1, emenda 1): o portão desta etapa proíbe número privado a quem não tem o direito. | um ramo da Tarefa 10 |
| 7 | "Canal inteiro" da tela B: o código de hoje chama de "normal do canal" a mediana dos últimos 28 dias; a tela B tem três cartões (canal inteiro, 90 dias, 28 dias). | **"Canal inteiro" = todos os dias guardados no diário de cada vídeo;** o número do próprio vídeo continua o dos últimos 28 dias (o que a A4 mostra). Mínimo de **1.000 views no período** para comparar, como no mockup; abaixo disso, "poucas views" em hachura. | Tarefas 14 e 15 |
| 8 | Em que grupo entra cada origem do YouTube? O mockup tem seis grupos; o YouTube tem 25 ou mais códigos. | A tabela da Tarefa 7: Pesquisa = pesquisa do YouTube; Sugeridos = vídeos sugeridos e relacionados; Início e inscrições = recursos de navegação; Feed de Shorts = Shorts; Sites e apps de fora = links externos; **todo o resto em "Outras origens"** (direto ou desconhecido, canais, playlists, notificações, tela final, cards, publicidade, hashtags, som, código que não conhecemos). "Não identificado" no país só aparece se o YouTube mandar essa linha (ele não manda hoje: conferência C0.2). | Tarefa 7 |
| 9 | Onde fica o grupo "De onde vêm as views" na página do **canal**? O mockup mostra uma página reduzida, sem as abas. | **Aba nova "Origem"**, a quinta, depois de "Retenção". *(emenda 1: S-I1)* As abas do canal trocam no navegador, sem ida ao servidor; por isso a leitura é feita em toda abertura do canal próprio, fora do caminho que segura a página (`Suspense`), e não "só quando a aba abre" como dizia a primeira versão (Tarefa 17). As duas células do mockup ("views no período" e "dias com origem medida") ficam numa faixa de números no topo da aba, sem mexer no cabeçalho aprovado da A4. Na página do vídeo o grupo entra depois da seção "Retenção". | Tarefa 17 |
| 10 | Data da mudança de contagem na régua: o mockup escreve 24/08/2026; o código do diário privado e a tabela em produção cortam em 27/08/2026. | **O mockup: 24/08/2026**, numa constante única (`MARCA_DE_CONTAGEM`), para trocar numa linha. Recomendo responder: a tela mostra dado do YouTube Analytics, cujo corte no código é 27/08. *(emenda 1: D-m3)* Dois fatos para a resposta: 24/08 é o corte da API pública (spec 01, D4), e 27/08 é o da Analytics, que é a fonte desta tela (`coleta/metric-version.ts:11`); e nenhum dia **medido** da origem cruza qualquer das duas datas (os relatórios em lote começam em 08/09 e as dimensões em 10/10), então a marca só pode valer para o total do período, nunca para a divisão. | uma constante da Tarefa 8 |
| 11 | A lista fechada de motivos de "não medido" do spec (6.1.5) não tem cinco motivos que os mockups aprovados usam. | **Ampliar a lista** com: "a janela fechou antes de começarmos a coletar"; "ainda não existe" (vídeo novo demais); "em revisão" (a soma passou do total); "o relatório do YouTube não chegou"; "a última busca falhou em dd/mm". A lista vira constante com teste (Tarefa 1). | Tarefa 1 |
| 12 | O item 241 do spec diz que as cores de direção (▲ ▼ ＝) são só para direção no tempo. O 11b usa as mesmas cores e símbolos na faixa do YouTube, e a tela B em "contra o canal inteiro" (o senhor aceitou os padrões dos dois). | **Aceito:** a faixa do YouTube e os cartões da tela B entram na lista de componentes que podem usar esses símbolos e cores. | uma linha de teste nas Tarefas 6 e 15 |
| 13 | Texto de quem não vê a curva: o mockup diz "só quem edita o canal a vê" e "peça acesso de edição". Depois do passo 0 da E17, quem tem o direito também vê. | **O mockup, palavra por palavra.** | uma frase da Tarefa 5 |
| 14 | Erro na origem das views. (a) O texto do mockup cita "a consulta das 14:32" ao YouTube e "a última consulta que deu certo"; a tela lê o nosso banco e, quando a leitura falha, não sabe nenhuma das duas. (b) Quando a **coleta** falhou mas há dias já medidos, o mockup 12 não desenhou. | (a) Ficam a primeira frase, a frase do que continua certo e o botão "Tentar de novo"; as duas frases que a tela não tem como saber saem. (b) **Os dias medidos continuam na tela, com um aviso acima**, no formato do aviso de erro do 11b ("A última busca falhou em dd/mm. A tela mostra os dias medidos até dd/mm."). Texto novo, passa pelo revisor de UX. | um ramo da Tarefa 10 |
| 15 | Janela de 7 ou 30 dias que fechou depois do começo da coleta, não foi lida e já passou dos 45 dias em que a coleta desiste. O mockup não tem esse estado. | Painel igual ao de "a janela não existe para este vídeo", com o texto "Ela fechou em dd/mm/aaaa e não conseguimos buscá-la nos 45 dias seguintes. Essa janela não volta." Texto novo, passa pelo revisor de UX. | um ramo da Tarefa 5 |
| 16 | Tela A: vídeo de 3 a 5 dias com todos os dias medidos em zero. A A4 mostra o gráfico de zeros (decisão 53, item 2); o mockup A, aprovado depois (decisão 62), mostra a faixa de 7 casas e "ainda cedo". | **Mockup A.** A idade é contada em dias do calendário do YouTube (Pacífico), como a regra de "vídeo novo" de hoje. | Tarefa 13 |
| 17 | A sequência diz que a E5 espera a E4 (medidas). Estas quatro telas não leem nenhuma medida da E4. | **Não esperar a E4 nesta parte.** | a ordem de envio |
| 18 | *(emenda 1: S-m5)* Na mesma página do vídeo, o dia da publicação é "dia 0 de 7" na janela aberta do 11b (fórmula do mockup 11b) e "dia 1" na faixa de 7 casas da tela A (LEIAME do lote 1). | **Cada tela como o seu mockup** (as duas contagens convivem). Recomendo unificar em "dia 1"; é uma linha na Tarefa 5. | uma conta da Tarefa 5 |
| 19 | *(emenda 1: D-m6, S-m8)* O cartão "Canal inteiro" da tela B atravessa as duas mudanças de contagem de views do YouTube (31/03/2025 e 27/08/2026, `coleta/metric-version.ts`) sem marca; o 12 tem a marca. | **O mockup B: sem marca.** Recomendo uma linha no ⓘ do cartão ("Atravessa duas mudanças na contagem de views do YouTube: 31/03/2025 e 27/08/2026."), texto novo que passaria pelo revisor de UX. | uma linha da Tarefa 15 |
| 20 | *(emenda 1: S-I2)* "Seus vídeos", na aba Origem do canal: quais? O conjunto que a A4 usa nas outras abas são só os **longos acompanhados** (`_chrome/page-data.ts:90`, `_proprio/extras.ts:22-27`); a coleta guarda a origem de **todos** os vídeos com data de publicação, e a tela tem o grupo "Feed de Shorts". | **O mockup ("seus vídeos"): todos os vídeos do canal que o Observatório traz, de qualquer formato, acompanhados ou não.** Se a resposta for "só os longos acompanhados", a frase da tela passa a dizer isso e o grupo "Feed de Shorts" continua (um longo também é visto pelo feed). | o conjunto da Tarefa 17 |

---

## 2. O que é do dono

Nenhuma migration, nenhuma variável de ambiente, nenhum comando no banco. O dono só responde às perguntas da seção 1 e, no fim, olha as telas em produção (conferência `e5b-d0`). Dependem dele, por outros planos: a aplicação do lote C (MG14, MG5, MG7 e, se entrar, MG11) e a autorização das consultas de leitura em produção da seção 3.2.

---

## 3. Fatos medidos

### 3.1 Fatos de que o desenho depende

| # | Fato | Fonte |
|---|---|---|
| F1 | Nenhuma tela pede coluna que não existe. Tudo o que as quatro telas mostram sai de: `yt_own_video_retention` (`points`, `collected_at`, `views_at_read`, `window_start`, `window_end`), `yt_own_collection_attempts` (`kind`, `outcome`, `attempt_day`), `yt_own_video_dim_daily`, `yt_own_video_traffic_detail_daily`, `yt_own_video_reach_dim_daily`, `yt_own_video_coverage`, `yt_own_video_daily` (`views`, `avg_view_percentage`), `yt_own_video_reach_daily`, e de `youtube_videos` (`published_at`, `duration_seconds`). | fatos 2.6; SQL de ensaio `mg5.sql:16-40`, `mg7.sql:32-116`, `mg14.sql:18-33`; `supabase/migrations/20261009000001_coleta_canais_proprios_l2.sql:16-38` |
| F2 | `views_at_read` é, na janela `vida`, o total de views da vida do vídeo no diário; nas janelas de 7 e 30 dias, as views **da janela**. Nulo quer dizer "não se sabia", nunca zero. | `retencao-regra.ts` (`vida(...)` passa `f.views_total`; as janelas passam `f.views_7d` e `f.views_30d`); `ler-retencao.ts`, `CurvaLida.viewsAtRead` |
| F3 | A janela de 7 dias inclui a publicação e os 6 dias seguintes; a de 30, os 29 seguintes. Uma janela só é lida se o último dia incluído for de 13/10/2026 em diante, se o diário já chegou até esse dia (cerca de 3 dias depois de fechar) e se não passaram 45 dias. | `retencao-regra.ts:122` e `:205-215` |
| F4 | Depois de uma tentativa **sem resposta** (erro), a coleta tenta de novo na execução seguinte (diária). Depois de uma resposta **vazia** na vida inteira, só tenta de novo com views novas e 7 dias passados. | `retencao-regra.ts:170-196` |
| F5 | O YouTube devolve HTTP 200 com `rows: []` para janela recente de vídeo com poucas views. O limiar de volume abaixo do qual isso acontece **não foi medido**. | `.superpowers/sdd/a5/conferencias-c0-resultado.md:15-29` (C0.1) |
| F6 | `day,country` dá 400 na API: país é uma consulta por vídeo e dia, e a soma dos países fica abaixo do diário (204 de 215 no exemplo). A API não manda linha de país "não identificado". | idem, `:31-46` (C0.2) |
| F7 | O CSV real de tráfego tem 7 linhas de dado em todo o bruto: o código 5 (pesquisa) veio com o detalhe vazio; o código 8 veio com texto livre. Que o código 8 seja busca **não foi verificado**. | idem (C0.2) |
| F8 | O canal tinha 36 views em 90 dias em 12/10; nenhum vídeo publicado nos últimos 45 dias (o mais novo é de 10/12/2024); 35 vídeos. | spec `00-indice-decisoes-e-sequencia.md:169`; plano da E8, linha 95 (P6) |
| F9 | **Comparação do YouTube por leitura, refeita por mim nas fixtures reais** (100 pontos cada): `yJl_YzInZ3U` vida, mediana 0,5559 e média 0,5408; `eibJk0L8zzc` vida, 0,5385 e 0,5365; `eibJk0L8zzc` até 2019, 0,5421 e 0,5348; `FHIgdLOzODE` vida, 0,3352 e 0,3595; `FHIgdLOzODE` até 2019, 0,3330 e 0,3601. Com os cortes do mockup, `yJl` dá "acima" pela mediana (0,56) e "na média" pela média (0,54). O valor muda de ponto para ponto (0,34 a 0,66 no `yJl`), então não é um resumo repetido. | `.superpowers/sdd/a5/c0-fixtures/c01-vida-so2.json` (chave `resposta`), `c01-comparacao-periodos.json` (chaves `…_vida_2m`, `…_ano2019_2m`), coluna 3 de `rows`; script de leitura local em 13/10 |
| F10 | **Ruído da curva, refeito por mim:** soma das subidas de `audienceWatchRatio` entre pontos vizinhos: 0,186 com 233 views; 0,255 e 0,268 com 323 views; 0,065 e 0,069 com 930 views. Com a regra de "trecho revisto" de hoje (subida de 0,02 ou mais), a curva de 323 views marca de 1 a 3 trechos; a de 930, nenhum. O ruído não cai de forma regular com as views nesses três vídeos, e não existe curva real com menos de 233 views. **Por isso o 500:** é o número redondo entre o maior volume em que o ruído aparece (323) e o menor em que ele some (930). Três vídeos não sustentam mais do que isso, e a pergunta 4 marca a revisão. | as mesmas fixtures, coluna 2 |
| F11 | O cliente da API pede `audienceWatchRatio`, `relativeRetentionPerformance` e `totalSegmentImpressions` por `elapsedVideoTimeRatio`. | `apps/web/src/lib/youtube/coleta/analytics-retencao.ts:13,66-68` |
| F12 | O mockup 11b usa as views **do vídeo** (cabeçalho) para decidir "poucas views" (`11b.js`, `V.views < 100`) e as views **da janela** no chip "N views na janela". | `11b.js:156,168,170` |
| F13 | O seletor do mockup 12 é uma lista de links com `aria-current`; a escolha é lembrada no navegador e a URL (`?periodo=`) vence. Padrão do exemplo: 7 dias. Períodos: canal 7, 28, 90 dias e "Desde {ano}"; vídeo 7 dias e "Desde a publicação". | `ov.js:15-22,315-318` |
| F14 | As tabelas das dimensões guardam o **nome** da API em `dim_value` (`YT_SEARCH`, `MOBILE\|ANDROID`, `BR`, `SUBSCRIBED`); as duas tabelas de lote guardam o **código numérico** do CSV. `rotuloOrigem` aceita os dois. | `mg7.sql:35`; `reporting/traffic-source-csv.ts:100`; `reporting/codigos.ts:44-70,138` |
| F15 | A página do vídeo já monta todos os blocos no servidor e passa ao cliente só a vista pronta; quem não edita recebe `{ acesso: 'negado' }` e o cliente de serviço nem é criado. | `…/competitors/video/[id]/page.tsx`; `_proprio/dados.ts` |
| F16 | Conferência vencida há mais de 7 dias sem `feitaEm` deixa o cron do canal próprio vermelho. A constante de deploy só é preenchida no commit do envio. | `apps/web/src/lib/conferencias.ts:1-24` |
| F17 | *(emenda 2: D-N1; é a conferência que o parecer de dados pediu, rodada por mim no código local)* **Um vídeo próprio que saiu do YouTube continua em `obs.videos`.** O carregador do Observatório só tira vídeo com `is_hidden = true`, e no código local `is_hidden` só é escrito pela ação manual do dono na lista de vídeos do CMS; a coleta reconhece a saída (403, 404, 410) e a trata como "ação do dono", sem esconder o vídeo. Então `videosDaOrigem` segue trazendo o vídeo e o cenário do achado vale inteiro, sem prazo. **Não medido:** se outra etapa (a fila "Saíram do YouTube", E9) passa a marcar ou esconder esses vídeos; se passar, o caso `parado` só dura até a marca, e nada neste plano muda. | `observatorio/load.ts:590,644` (`.eq('is_hidden', false)`); `app/cms/(authed)/youtube/videos/actions.ts:22` e `video-row-actions.tsx:143`; `coleta/atraso-permanente.ts:26,48-60`; `grep -n "acaoDoDono\|privacyStatus" apps/web/src/lib/youtube/observatorio/*.ts`: vazio |

### 3.2 Conferências pendentes (o controlador roda; produção só leitura, com a autorização do dono)

Nenhuma foi rodada por mim. O texto completo de cada consulta está no Apêndice A. O que muda conforme a resposta:

| # | O que confere | O que muda |
|---|---|---|
| C-1 | As cinco tabelas e a função `can_view_private_site` ainda não existem em produção | Esperado: tudo nulo. Se algo existir, o lote C andou e a ordem de envio da seção 7 é refeita. |
| C-2 | Vídeos publicados de 14/09/2026 em diante *(emenda 1: D-m1: a janela de 30 dias é coletada quando publicação + 29 cai em 13/10/2026 ou depois, isto é, publicação de 14/09 em diante; a primeira versão filtrava 01/10)* | Esperado: 0 linhas. Com 0, os cartões de 7 e 30 dias de todos os vídeos existentes leem "fechou antes da coleta" e os estados "aberta" e "lida" de 7 e 30 dias só serão vistos em produção quando o dono publicar. A conferência `e5b-d28` passa a ser "ao primeiro vídeo novo". |
| C-3 | Views por vídeo em 28 e 90 dias e na vida | Se nenhum vídeo passa de 1.000 views em 90 dias, todo cartão de 28 e de 90 dias da tela B lê "poucas views" (é o esperado; o plano não muda). *(emenda 1: D-m2)* A segunda consulta da C-3 conta quantos vídeos têm 500 e 100 views na vida: se quase nenhum passa de 500, todas as curvas de vida saem como "indício", sem "maiores saídas" nem "trechos revistos"; o plano não muda (é o que o dado sustenta), a seção 7 passa a dizer o número e o dono é avisado antes do envio do lote E5b-R. |
| C-4 | Valores reais de `dim_value` (depois da primeira execução do passo "dimensões") | Fecha a tabela de grupos da Tarefa 7: código que não estiver nela cai em "Outras origens" e aparece na contagem `naoCatalogados`. Se aparecer `ZZ` em país, a linha "Não identificado" passa a existir. |
| C-5 | Dias em que a soma das origens passa do diário | Se for 0, o estado "origem em revisão" fica só nos testes. Se passar de 0 com frequência, a regra "um dia em revisão põe o bloco inteiro em revisão" (Tarefa 8) trava a tela e é revista na conferência `e5b-d7`. |
| C-6 | Ruído da curva contra `views_at_read` (depois da primeira leva de retenção) | Com 5 curvas ou mais de volumes diferentes, o limiar da pergunta 4 passa a ser o corte observado; com menos, fica 500 e a revisão é remarcada. |
| C-7 | Mediana contra média da comparação em todas as curvas reais | Se as duas ficam sempre do mesmo lado de 0,45 e de 0,55, a pergunta 3 perde o efeito prático. |
| C-8 | O que a documentação oficial diz de `relativeRetentionPerformance` (o que é 0, 0,5 e 1) | O texto do ⓘ da faixa ("0,5 é o vídeo do meio") depende disso. De memória, a documentação descreve 0 como o pior, 1 como o melhor e 0,5 como a mediana dos vídeos de duração parecida; **não a consultei**, e a frase do ⓘ só vai para a tela depois de conferida. Comando: abrir `https://developers.google.com/youtube/analytics/metrics` e ler a entrada `relativeRetentionPerformance`. |
| C-9 | Tentativas de 7 e 30 dias gravadas | Confirma que o leitor precisa dos três `kind` (Tarefa 4). |
| C-10 | Quantas linhas do diário têm `views > 0`, e desde que dia o diário de cada vídeo existe | **Decide a Tarefa 9.** *(emenda 1: D-I6, S-I8)* O corte sai da meta de tempo, não do teto de linhas: até **10.000 linhas** (10 idas ao banco de 1.000 linhas) segue com leitura direta paginada. O tempo por ida **não foi medido**; 10 é estimativa e a Tarefa 18 mede. *(emenda 1: S-m8)* A segunda consulta da C-10 compara o primeiro dia do diário de cada vídeo com a publicação: se o diário não cobre a vida, o cartão passa a se chamar "Desde dd/mm/aaaa" (o primeiro dia lido), em vez de "Canal inteiro", e o total de "Desde {ano}" da origem lê "não medido" (Tarefa 17). Acima do corte: a Tarefa 9 **para e avisa**; o cartão "Canal inteiro" passa a precisar de uma função de agregação no banco (migration nova, fora deste plano) e a tela B é enviada só com 90 e 28 dias depois de o dono decidir. |
| C-11 | O conjunto do Observatório traz o total público de views do canal | *(emenda 1: D-m5, S-I2)* **Deixou de decidir.** O total de "Desde {ano}" não vem mais do contador público do canal (outra fonte, outra regra de contagem e outra população de vídeos): vem do diário, o mesmo dado e os mesmos vídeos da divisão (Tarefa 17). |
| C-12 | Datas reais do lote C, do envio da E8-coleta e da E11 | Substituem as previsões (`DIMENSOES_DESDE`, `DIMENSOES_LIGADO_EM`, `E8_COLETA_DEPLOY`). As telas leem as constantes; nenhuma data é digitada em tela. |
| C-13 | O teste do item 241 (uso dos símbolos e cores de direção) já existe? | `grep -rnE "dir-up|dir-dn|dir-eq" apps/web/test apps/web/src --include=*.ts --include=*.tsx --include=*.css -l`. Se existir, as Tarefas 6 e 15 acrescentam os dois componentes à lista dele; se não, a anotação vai ao ledger para quem o criar. |
| C-14 | A versão do plano da E17 que vale e se a Tarefa 6 de lá já está no HEAD | `ls apps/web/src/lib/youtube/observatorio/proprio/leitura-privada.ts`. *(emenda 1: S-I9)* Não decide mais um ramo de código (o ramo condicional saiu); decide só quais testes do segundo nível ("tem o direito e não edita") já podem ser escritos e a ordem serial no arquivo de varredura (0.3). |
| C-15 | *(emenda 1: S-I2)* Quantos vídeos do canal próprio existem no banco, quantos o Observatório traz e quantos são longos acompanhados | Mede o tamanho do desvio da pergunta 20. Se o Observatório trouxer menos vídeos do que a coleta guarda, o ⓘ da origem diz "N vídeos lidos" e a diferença vai ao ledger como dívida. Consulta no Apêndice A; a contagem do Observatório sai de `grep -n "tracked\|video_limit" apps/web/src/lib/youtube/observatorio/*.ts` e da leitura do carregador. |
| C-16 | *(emenda 1: D-I7)* No primeiro vídeo novo: alguma resposta vazia de 7 ou 30 dias virou `ok` numa tentativa posterior? | Com data: "ao primeiro vídeo novo" (junto da `e5b-d28`). Se virou, a pergunta 1 se responde com fato (manter a regra de hoje). Se nunca virou em 45 dias, o dono pode escolher o mockup sem perder dado. |

---

## 4. Desenho, no que difere de "copiar o que já existe"

**4.1 Uma leitura no servidor, todas as escolhas já montadas.** As três telas com seletor (janela da curva, período da origem, período do % assistido) lembram a escolha no navegador, e a URL vence. O servidor monta a vista de **todas** as opções a partir de uma leitura só (a mais larga contém as outras) e entrega a um componente cliente pequeno um mapa `opção → conteúdo já renderizado`. O cliente só troca qual filho aparece. Consequências: nenhuma nova ida ao servidor ao trocar; a escolha lembrada aparece depois da hidratação (o primeiro HTML traz a opção da URL ou o padrão, e há uma troca visível para quem tem escolha salva: declarado em 13); e o dado privado continua nascendo no servidor, já em texto. Passar conteúdo renderizado como propriedade é permitido no Next 16; o que não pode é passar um componente importado (como `next/link`) como propriedade, e nenhum destes componentes recebe um. *(emenda 1: S-m2)* Cada seletor tem o seu parâmetro de URL (`?janela=`, `?origem=`, `?assistido=`): o `?periodo=` único do mockup faria um seletor herdar o valor do outro na mesma página (desvio 13).

**4.2 Estado por bloco, com uma função só.** No 12, cada bloco decide entre medido, zero medido, não medido, ainda não existe, dado que você não vê, erro e em revisão pela mesma função (Tarefa 8), na ordem do mockup (`resolve` em `ov.js`): sem dias medidos é "não medido" com o motivo; com dias medidos e total 0 é "zero medido"; senão "medido". O leitor nunca devolve 0 nem nulo solto.

**4.3 "Dia medido" é o dia inteiro.** Na página do canal um dia só entra na conta de um bloco quando **todos** os vídeos lidos estão cobertos naquele conjunto e têm a referência medida naquele dia. É a regra conservadora que faz "total = soma das linhas + omitido" fechar com o diário; um vídeo atrasado tira o dia da barra e ele aparece na régua como não medido. *(emenda 1: D-I1, S-I3)* A regra tem um limite, para um vídeo só não apagar a aba inteira para sempre: o vídeo que **não tem nenhum dia medido no período inteiro** (saiu do YouTube, ficou privado, o diário dele parou, ou o teto de 400 consultas da coleta o cortou) sai do "todos", e a tela diz quantos saíram ("N de M vídeos fora desta conta: sem leitura no período"). O total continua fechando, porque é a soma da referência dos vídeos que ficaram. Quando nem assim há um dia com todos medidos, o motivo é o novo `cobertura_parcial`, nunca "A coleta ainda não começou." (Tarefas 1 e 8). *(emenda 2: D-N1)* **Uma regra só para "quem está na conta", e ela vale para a divisão e para o total.** A função pura `quemEstaNaConta` (`LIB/na-conta.ts`, Tarefa 8, commit 8a) recebe, por vídeo, os dias medidos do período e devolve três grupos: **fora** (nenhum dia medido no período: a regra da emenda 1); **parado** (o último dia medido do vídeo no período é anterior a `ate − 8`, os mesmos 8 dias de `DIAS_DE_ATRASO_ANTIGO` em `coleta/diario-step.ts:30`): o vídeo é exigido só **até** esse último dia, e não nos dias seguintes; e **na conta** (exigido no período inteiro). A tela diz os dois números: "N de M vídeos fora desta conta" e "N de M vídeos sem leitura depois de dd/mm: os dias seguintes contam só os outros." Sem a segunda parte, um vídeo que sai do YouTube (a cobertura dele para no dia da saída e não volta, `mg14.sql:25`) congelaria "Desde {ano}" para sempre no dia da saída e apagaria o total do período em todos os períodos. A divisão aplica a regra aos dias em que o vídeo tem o conjunto coberto **e** a referência medida; o total do período aplica **a mesma função** aos dias com cobertura `base` (Tarefa 9). Não passo ao total a lista de vídeos da divisão, como o parecer sugeriu: um vídeo com o diário em dia e a origem sem leitura tem views conhecidas, e tirá-las do total seria perder dado; cada número diz de quantos vídeos é. Num período de 7 dias a regra dos 8 dias nunca dispara (não cabe no período): vale só a de "fora", como antes. Um dia em que nenhum vídeo é exigido não é medido.

**4.4 Períodos longos em trechos.** `lerDimensoes` recusa janela acima de 120 dias. Como só há cobertura a partir das datas de partida, "Desde a publicação" e "Desde {ano}" pedem `[max(início do período, menor data de partida), último dia entregue]`, em trechos de até 120 dias e lotes de até 50 vídeos, no máximo 12 chamadas por leitura (Tarefa 9; *(emenda 1: S-m7)* o limite conta chamadas a `lerDimensoes`, isto é, trechos de data **vezes** lotes de 50 vídeos). *(emenda 1: D-m10)* "Último dia entregue" é, em termos de dado, o `ultimoDia` do `lerDiario` tolerante (Tarefa 5 da E6: o maior entre a última linha do canal e o maior `covered_to` do conjunto `base`); todos os períodos desta etapa terminam nele, e é o mesmo que a A4 usa na mesma página. O número de dias do período (o M de "N de M dias") é aritmético, não lido. Hoje é um trecho; passa a dois em 06/01/2027 (lote) e 07/02/2027 (dimensões), se as previsões de data se confirmarem.

**4.5 Três níveis de acesso, dois tokens.** Quem edita vê tudo. Quem tem o direito de ver desempenho privado e não edita vê tudo menos termos e sites. Quem não tem nenhum dos dois vê o aviso, sem número. Antes do passo 0 da E17 existir no HEAD, o segundo nível não existe e o código é o mesmo (o token de leitura é o de edição). Termos e sites têm entrada própria (`_proprio/dados-termos.ts`), que pede a prova de **edição** em qualquer das duas situações. *(emenda 1: S-I9, S-I10)* É a única barreira dos termos (não há segunda prova dentro do leitor) e ela prova a edição **do site que está dentro do token de leitura**, nunca de um site recebido por parâmetro.

**4.6 A faixa do YouTube.** O número é a mediana arredondada a duas casas; a zona é decidida sobre o número arredondado, que é o que o dono vê. A regra mora em `retencao-curva.ts`, num lugar só.

**4.7 Nenhuma cor por `color-mix()`.** Toda cor que carrega informação (zonas da faixa, hachura do "não medido", fatias da barra) é literal `rgba` ou hex, copiada do CSS do mockup (`11b.css`, `ov.css`, `lote.css`). Teste de CSS em cada tarefa de componente.

---

## 5. As contas

**5.1 Cota de API e cron.** Zero. Esta etapa não faz chamada ao YouTube, não cria cron, não toca o relógio do cron do canal próprio (a soma de 245 s de 270 s da reconciliação não muda). Não há interruptor por variável porque não há cron.

**5.2 Linhas gravadas.** Zero. Só leitura. Nada a mais por dia nem por ano.

**5.3 Consultas ao banco por abertura de página** (cliente de serviço, depois do token):

| Página | Hoje | Depois | De onde vem o acréscimo |
|---|---|---|---|
| Vídeo próprio | alcance e diário do canal, mais as 5 a 6 da retenção (Tarefa 13 da E8) | **+ 2** na retenção (histórico da vida; a mais antiga); *(emenda 1: D-I3, S-I5)* **+ 2** de tentativas (uma consulta por tipo, três em paralelo, onde havia uma) e até **3** buscas de reserva, uma por tipo, onde hoje há até 1 *(emenda 2: D-n4; a primeira redação dizia "+ 2" sem dizer que era a diferença)* ("a última com resposta", só quando as 30 mais novas daquele tipo são todas falha); **+ 8** das dimensões (um trecho, um vídeo); **+ 4** do detalhe, só para quem edita; **+ 1** do diário de 90 dias, **+ 1 paginada** do diário inteiro (tela B, até 10 páginas) e *(emenda 1: D-I2)* **+ 1** dos intervalos `base` da cobertura; as três últimas dentro de `Suspense` próprio. *(emenda 2: S-n6)* No `Suspense` da origem: **+ 1** do diário do período, **+ 1** do diário de "Desde a publicação" (um vídeo: uma página) e **+ 2** da cobertura `base` | Tarefas 4 e 9 |
| Canal próprio, aba "Origem" | não existe | 8 das dimensões + 4 do detalhe + 1 do diário do período, por chamada (trecho × lote de 50 vídeos). *(emenda 1: S-I1)* Pagas em **toda** abertura do canal próprio, dentro de `Suspense`. *(emenda 2: S-n6)* Mais, por lote de 50 vídeos: **+ 1 paginada** do diário inteiro com `soComViews` (até 10 páginas), para o total de "Desde {ano}", e **+ 2** da cobertura `base`. É uma **segunda** leitura paginada do diário inteiro na mesma abertura do canal: a da aba "Retenção" lê os longos acompanhados (`ownYtIds`) e esta lê `videosDaOrigem`; são conjuntos diferentes e as duas não se juntam | Tarefas 9 e 17 |
| Canal próprio, aba "Retenção" (% assistido) | diário de 38 dias | + 1 de 90 dias + 1 paginada do diário inteiro (até 10 páginas) + 1 da cobertura `base`, dentro de `Suspense` *(emenda 1: D-I6, S-I8)* | Tarefa 9 |
| Comparação, cartão "Só o seu canal mede" | alcance por canal próprio | + 8 das dimensões por canal próprio **do par** (7 dias) e + 4 do detalhe para quem edita | Tarefa 12 |

**5.4 Tamanho do que se lê.** Retenção: até 27 leituras com pontos (a mais antiga e as 26 mais recentes), cerca de 6 KB cada: 160 KB no pior caso, e o pior caso leva meio ano de releituras semanais. Dimensões de um vídeo em 120 dias: no máximo 120 × cerca de 40 linhas = 4.800 linhas (5 páginas); no canal de hoje, dezenas de linhas (36 views em 90 dias). Canal com 35 vídeos: teto de 100.000 linhas por leitura; acima, o leitor lança e o bloco lê erro, em vermelho. Diário de 90 dias de 50 vídeos: 4.500 linhas. Diário inteiro com `views > 0`: **não medido** (conferência C-10; *(emenda 1: D-I6, S-I8)* teto de 10.000 linhas, que são 10 idas ao banco em série; a primeira versão dizia 60.000, que seriam 60 idas e não fecham com a meta de tempo).

**5.5 Tempo.** As páginas têm `maxDuration = 60`. O grupo da origem é entregue dentro de um `Suspense`, então o que já existe na página não espera por ele. *(emenda 1: D-I6, S-I8)* Os cartões de período da tela B (diário de 90 dias e diário inteiro) também vão em `Suspense` próprio, na página do vídeo e na do canal: nenhuma leitura paginada fica no caminho que segura o primeiro HTML. A conta que justificou a mudança: o PostgREST devolve 1.000 linhas por ida; a 50 ms por ida, 60.000 linhas seriam 3 s e 10.000 são 0,5 s. Os 50 ms são **estimativa**, ninguém mediu; a Tarefa 18 mede com uma semente do tamanho que a C-10 devolver. Meta: o acréscimo de leitura abaixo de 1,5 s no percentil 95, medido na Tarefa 18 com o banco local semeado. **Quando estoura:** o leitor que passa do teto de linhas lança; a entrada (Tarefa 9) transforma em `{ acesso: 'erro' }` só naquele grupo, avisa o Sentry uma vez por requisição, e a tela mostra o bloco de erro com "Tentar de novo". Nunca lista vazia.

**5.6 O que a própria tela grava no navegador.** Três chaves de `localStorage`: `obs-proprio-curva-janela`, `obs-proprio-origem-periodo`, `obs-proprio-assistido-periodo`, cada uma com um valor curto de uma lista fechada. Leitura e escrita em `try/catch`; valor desconhecido é ignorado. Nada privado é guardado.

---

## 6. O que acontece quando o dado não existe, e em cada falha

Dado ausente primeiro. Nenhuma destas linhas manda e-mail (a tela não tem cron); o veredito diz o que o dono vê.

| Situação | 11b (retenção) | 12 (origem) | A e B | Veredito |
|---|---|---|---|---|
| **Tabela ausente** (migration não aplicada) | `tabelaAusente`: a vida lê "Ainda não coletamos esta curva"; as de 7 e 30 dias leem o que o calendário diz ("fechou antes da coleta" ou "a janela ainda não fechou") e, fora desses dois casos, "Ainda não coletamos" *(emenda 1: S-m9)*; aviso ao Sentry (já existe no leitor) | `schema_ausente`: todo bloco lê "não medido". Com hoje até `DIMENSOES_LIGADO_EM`: "A coleta começa em dd/mm."; depois dessa data: "A coleta ainda não começou." (sem data, para não afirmar uma data que já passou) e aviso ao Sentry | não se aplica (tabelas já em produção) | nota; não é verde |
| **Tabela existe e está vazia** (coleta ainda não rodou) | sem linha e sem tentativa: vida "Ainda não coletamos"; 7 e 30 dias pelo calendário (aberta, fechou antes, não coletada) | `nao_coletado`: "não medido" com a data | A: "não medido" com o motivo do dia (`montarDias`); B: "ainda não dá para comparar" | nota |
| **Dia sem linha, dentro da cobertura** | não se aplica | soma fecha com o diário: "zero medido"; soma abaixo: o valor aparece como o símbolo de "sem número" e a diferença vai para "omitido pelo YouTube" | A: 0 dentro da casa é "zero medido" | verde, é medida |
| **Dia fora da cobertura** | não se aplica | não entra em "dias medidos"; a régua mostra a hachura e a data de partida | A: "não medido: o dia ainda não chegou" | nota |
| **Valor nulo numa linha** | ponto de forma ruim derruba a curva (`janelasIlegiveis`): "A leitura da curva falhou", nunca "ainda não coletamos" | linha com contagem nula tira o dia dos dias medidos (não se afirma omitido com nulo na mão) | dia com views e sem percentual não entra na conta (regra de hoje) | vermelho no 11b; nota no 12 |
| **`views_at_read` nulo** | tratado como poucas views, com a frase sem número (pergunta 4) | não se aplica | não se aplica | nota |
| **Data de publicação ausente** | 7 e 30 dias: "ainda não coletada", sem data; vida segue | "Desde a publicação" não é oferecido; o seletor fica com "7 dias" | A: o estado de hoje ("não medido") | nota |
| **Duração ausente ou zero** | tempos em % do vídeo, nunca "0:00" (regra da Tarefa 13 da E8) | não se aplica | B: vídeo sem faixa de duração fica fora da faixa (regra de hoje) | nota |
| **Resposta vazia do YouTube** (`sem_dado_na_janela`) | "O YouTube não devolveu curva para este vídeo (poucas views)", com a data da resposta, mesmo que haja erro mais novo | abaixo do limiar: "omitido pelo YouTube" | não se aplica | nota |
| **Última tentativa da coleta falhou** (403, 429, 500, tempo) | com leitura anterior: a curva continua e o aviso diz a data da falha e a da próxima tentativa; sem leitura: "A primeira tentativa falhou em dd/mm" | `coleta_em_erro`: com dias medidos, os dias continuam e o aviso aparece acima (pergunta 14); sem nenhum, bloco de erro | não se aplica | **vermelho na tela, com o motivo escrito** (a família do erro vem do catálogo de resultados da coleta; o texto cru da API nunca chega à tela) |
| **Passo desligado** (`YT_OWN_STEPS_OFF`) | sem efeito na leitura | `passo_desligado`: com dias, os dias e o aviso "A coleta da origem está desligada."; sem dias, "não medido" com essa frase | não se aplica | nota |
| **Erro de banco na leitura** | só a seção lê "A leitura da curva falhou agora; recarregue a página."; o resto da página aparece | só o grupo lê o bloco de erro com "Tentar de novo"; o resto da página aparece | A e B dependem do alcance e do diário, cuja falha derruba a página (regra D5 de hoje, não muda) | **vermelho, com o motivo escrito**; Sentry uma vez por requisição |
| **Passou do teto de linhas ou de trechos** | histórico cortado: a lista diz "mostrando a primeira e as 26 mais recentes" | o leitor lança: bloco de erro | B: a entrada lança, bloco de erro no "Canal inteiro" | vermelho |
| *(emenda 1: D-I2)* **Diário sem cobertura no período** (falha de coleta de dias; tabela de cobertura ausente) | não se aplica | o total do período lê "não medido" com "N de M vídeos com o período inteiro medido"; a divisão continua, só dos dias medidos. *(emenda 2: D-N1)* O buraco é contado **naquele** período (um buraco de 40 dias atrás não apaga o total de 7 dias) e só entre os vídeos da conta | B: o percentual continua (ele só usa dia com view); o total de views do período não aparece; *(emenda 2: D-n2)* cartão com soma abaixo de 1.000 views e cobertura incompleta lê "não medido" pela cobertura, nunca "poucas views" | nota; nunca um total menor em silêncio |
| *(emenda 1: D-m9)* **Vídeo sem diário em dia** (a coleta da retenção nunca o tenta) | a vida lê "Ainda não coletamos esta curva" enquanto durar; não é verde porque o cron do canal próprio fica vermelho por `semDiarioEmDia` | o vídeo sai da conta pela regra de 4.3 | sem efeito | nota na tela, vermelho no cron |
| *(emenda 2: D-N1)* **Vídeo que saiu do YouTube** (apagado ou privado: a cobertura dele para no dia da saída e não volta; ele continua em `obs.videos`, fato F17) | a vida continua mostrando a última leitura, com a data dela | por até 8 dias os dias novos não são medidos (ele é só mais um atrasado); depois ele vira "parado": os dias seguintes voltam a ser medidos com os outros, e a tela diz "N de M vídeos sem leitura depois de dd/mm". Quando o período não tem mais nenhum dia dele, passa a "fora desta conta". O total do período segue a mesma regra e diz de quantos vídeos é. Na página **desse** vídeo: os dias medidos até a saída e "Sem leitura depois de dd/mm." | B: sem efeito (só entra dia com view) | nota, com a contagem na tela; aviso ao Sentry uma vez por requisição |
| *(emenda 1: S-m6, D-m4)* **A leitura dos termos falha, ou é negada a quem edita** | não se aplica | só o bloco de termos e sites lê "Não conseguimos ler agora" com "Tentar de novo"; nunca "Nenhum termo apareceu" nem "Você não vê este dado" | não se aplica | vermelho no bloco; Sentry uma vez por requisição |
| **Soma das origens maior que o diário** | não se aplica | bloco da origem "em revisão"; aparelho, país e inscritos seguem com a conta deles; termos sem comparar com a pesquisa | não se aplica | nota, nunca zero |
| **Dado parcial** (parte dos vídeos coberta) | não se aplica | o dia sai dos dias medidos (4.3); *(emenda 1: D-I1, S-I3)* vídeo sem nenhum dia medido no período sai da conta e é contado na tela; sem nenhum dia em comum, "não medido" com o motivo `cobertura_parcial` e "faltam N de M vídeos"; a página avisa o Sentry com a contagem *(emenda 2: S-n5: o aviso é de `OrigemDoVideo` e `OrigemDoCanal`, não da entrada)* | B: vídeo além do teto de 50 fica dito ("ficaram de fora N vídeos"), como hoje | nota |
| **Sem o direito de ver** | "Você não vê esta curva." e os cartões com cadeado; nenhum número, data nem SVG | aviso "Dado que você não vê", sete blocos nomeados; nenhum número | as frases de hoje da A4 | nota |
| **Código de origem, aparelho ou país desconhecido** | não se aplica | entra em "Outras origens", "Outros aparelhos" ou "Outros países"; a contagem `naoCatalogados` vai ao Sentry sem o conteúdo; a soma continua fechando | não se aplica | nota |

---

## 7. Simulação: o estado real por semanas, tela por tela

A coleta começa no deploy. Com o canal de hoje (F8) e o lote C ainda por aplicar:

**11b, retenção.**
- **Antes do lote C:** tabela ausente. Vida: "Ainda não coletamos esta curva" (o caso `nao-coletada` do mockup). 7 e 30 dias dos 35 vídeos: "fechou antes da coleta", que é fato de calendário e não depende da tabela *(emenda 1: S-m9)*.
- **Lote C aplicado, coleta ainda não enviada:** tabela vazia, sem tentativas. Vida: "Ainda não coletamos". 7 e 30 dias dos 35 vídeos: "fechou antes da coleta" (todos foram publicados até 10/12/2024; o último dia das janelas é anterior a 13/10/2026).
- **Primeira semana da coleta:** a vida inteira é lida em levas de 7 dias (cada vídeo tem o seu dia). Para cada vídeo, um de dois: a curva aparece, ou "O YouTube não devolveu curva para este vídeo (poucas views)" com a data. Quase todo vídeo terá **uma** leitura: a nota "Só há uma leitura (dd/mm). “Como a curva mudou” aparece a partir da segunda." é o estado normal por semanas, e a segunda leitura só vem para vídeo com views novas.
- **Faixa do YouTube:** aparece junto com cada curva lida. Curva de leitura com menos de 500 views ganha "Só N views: leia como indício" e fica sem saídas e trechos marcados. *(emenda 1: D-m2)* **Conferência pendente:** quantos dos 35 vídeos têm 500 views na vida não foi medido (segunda consulta da C-3). Se forem poucos, o estado normal do 11b por meses é "indício" em quase todo vídeo, sem as duas listas.
- **Quando o dono publicar um vídeo:** vida "Vídeo novo: a primeira leitura vem nos próximos dias."; 7 e 30 dias "a janela ainda não fechou", com "fecha em" e a barra. São os primeiros estados "aberta" e depois "lida" de 7 e 30 dias que produção verá.

**12, origem.**
- **Antes do lote C e antes de `DIMENSOES_LIGADO_EM`:** todos os blocos "não medido", com "A coleta começa em dd/mm". A célula "dias com origem medida" lê "0 de N".
- **Primeiro dia da coleta:** origem, aparelho, país e inscritos cobrem os 10 dias anteriores ao deploy; termos, sites e impressões por origem cobrem desde 08/09 (os relatórios em lote já guardados). Cada bloco diz o seu "Medido em N de M dias".
- **Com 36 views em 90 dias:** o estado típico é o "magro" do mockup: "o YouTube disse a origem de só X views das Y, e Z foram omitidas". As listas mostram o símbolo de "sem número" em quase toda linha. Termos: "Nenhum termo apareceu." (o bruto inteiro tem 7 linhas de dado: F7). Nada disso é zero e a tela não diz zero.
- **Período "Desde {ano}":** a régua em faixa quebrada mostra uns poucos dias medidos contra milhares; é o que o mockup desenhou.
- *(emenda 1: D-I1, S-I3)* **Coleta rodando e um vídeo que nunca ganha cobertura** (privado, apagado, sempre em erro), ou a primeira execução cortada pelo teto de 400 consultas: os blocos **não** ficam em branco. O vídeo sem nenhum dia medido no período sai da conta e a tela diz "N de M vídeos fora desta conta"; se nem assim houver dia em comum, "não medido" com "faltam N de M vídeos". Em nenhum dos dois casos a tela diz "A coleta ainda não começou." *(emenda 2: D-N1)* Um vídeo que sai do YouTube no meio do caminho: nos primeiros 8 dias os dias novos ficam sem medir; do nono em diante voltam, com a linha "1 de 35 vídeos sem leitura depois de dd/mm"; em 7 dias ele some do período de 7 dias (passa a "fora desta conta"), em 28 do de 28, em 90 do de 90, e em "Desde {ano}" fica como "parado" para sempre, com a linha. O total de cada período acompanha.

**A, "ainda cedo".** Só aparece para vídeo com menos de 6 dias de vida. Hoje não há nenhum: a tela é exercitada na semente e nos testes até o dono publicar.

**B, % assistido por período.** *(emenda 1: S-m8)* **Conferência pendente:** que o diário cobre anos **não foi medido** (a primeira versão afirmava "anos de diário"); a C-10 traz o primeiro dia do diário por vídeo contra a publicação. Se cobrir, "Canal inteiro" tem volume. Se o diário for curto, o cartão se chama "Desde dd/mm/aaaa" e pode ele também ler "poucas views". "Últimos 90 dias" e "Últimos 28 dias" ficam abaixo de 1.000 views no período: os dois cartões leem "poucas views" em hachura, sem comparar. É o caso "poucas views" do mockup, e é o estado real enquanto o canal estiver parado.

---

## 8. Desvios do texto do spec e dos mockups, com o motivo

1. **Spec 7.2 diz que o leitor mora em `lib/proprio/`.** O código mora em `apps/web/src/lib/youtube/observatorio/proprio/`. Sem efeito.
2. **Spec 7.3 v2.3 e item 89:** "quem lê estas tabelas é quem tem o direito". Para termos e sites vale o que o dono aprovou no 12: só quem edita (pergunta 5). É mais restrito que o spec, não menos.
3. **Mockup 12, variante "só o total":** não mostra o total do período (pergunta 6).
4. **Mockup 12, texto do erro:** duas frases saem porque a tela não tem o dado (pergunta 14a).
5. **Mockup 12, "O que ainda não é medido: Curva de retenção: ainda não é coletada."** O mockup retrata o dia de hoje, antes da E8. A linha "Origem do tráfego" sai (certo nos dois casos). A linha da curva fica como o mockup enquanto a tela da E8 não estiver no HEAD; com ela no HEAD, a lista fica vazia e a seção some (a frase seria falsa).
6. **Mockup 11b, "fechou antes da coleta":** o mockup compara o dia do vencimento (publicação + 7 ou + 30) com o início da coleta; a coleta compara o **último dia incluído** (publicação + 6 ou + 29). A tela usa a regra da coleta, porque é ela que decide se a janela será buscada: com a regra do mockup, um vídeo no dia de fronteira leria "ainda não coletada" para sempre. O texto e a data mostrada ("Ela fechou em dd/mm/aaaa") são os do mockup.
7. **Mockup 11b, "poucas views":** o mockup decide pelas views do vídeo; a tela decide pelas views **da leitura** (`views_at_read`), que nas janelas de 7 e 30 dias são as da janela (F2, F12). É o número que diz se aquela curva balança.
8. **Mockup 11b, "Tentamos de novo em dd/mm":** o exemplo mostra 7 dias depois; a coleta tenta de novo na execução diária seguinte (F4). A data na tela é o maior entre o dia seguinte ao da falha e hoje.
9. **Mockups, chaves de `localStorage`:** `a5l2-janela` e `a5l2-12-periodo` são do mockup; produção usa as de 5.6.
10. **Lote 1, dívida B7:** os cartões de período da tela B são `radiogroup`, não links (o próprio LEIAME manda).
11. **Lote 1, dívida B5:** "poucas views" usa a hachura do "não medido" (o LEIAME a declarou; o dono aprovou a tela com ela).
12. **Itens de aceite das telas A e B:** o spec não tem. A seção 12 propõe E5B-1 a E5B-12; o controlador dá os números definitivos.
13. *(emenda 1: S-m2)* **Mockups 12 e B, parâmetro `?periodo=`:** em produção os dois seletores moram na mesma página; a origem usa `?origem=` e o % assistido usa `?assistido=`.
14. *(emenda 1: D-I7)* **Mockup 11b, "Esta janela é buscada uma vez só"** na janela de 7 ou 30 dias com resposta vazia: a frase só vale se a coleta mudar (pergunta 1). No padrão, a coleta continua tentando e a frase é a alternativa.
15. *(emenda 1: D-I1, S-I3)* **Mockup 12, vídeo fora da conta:** o mockup não desenhou "N de M vídeos fora desta conta" nem o motivo `cobertura_parcial`. São dois textos novos, na forma do "não medido" aprovado, e passam pelo revisor de UX. *(emenda 2: D-N1, D-n1, D-n2, S-n4)* Mais sete textos novos, também para o revisor de UX: "{N} de {M} vídeos sem leitura depois de dd/mm: os dias seguintes contam só os outros."; "de {N} dos {M} vídeos" ao lado do total do período; na página do vídeo, "Este vídeo não tem nenhum dia medido no período." e "Sem leitura depois de dd/mm."; no 11b, "Tentamos até dd/mm e o YouTube não devolveu curva. Essa janela não volta."; na tela B, "não medido: {N} de {M} vídeos sem o período inteiro medido" e "não medido: não sabemos se o período inteiro foi coletado".

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`. `LIB` = `src/lib/youtube/observatorio/proprio`; `APP` = `src/app/cms/(authed)/youtube/competitors`; `T` = `test/youtube/observatorio`. "Novo" = criado por esta etapa. **A lista de cada tarefa é fechada: se a tarefa precisar de outro arquivo, para e avisa.**

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0 | Congelar os mockups, rodar as conferências, atualizar o roteiro | `docs/superpowers/mockups/2026-10-13-a5-lote-2/11b-retencao-janela-e-faixa/**` e `…/12-origem-das-views/**` (commit sem `shots/`); `.superpowers/sdd/a5-e5b/mockup-congelado/**` (novo); `.superpowers/sdd/a5-e5b/progress.md` (novo); `docs/superpowers/mockups/ROTEIRO-DE-TESTE-E-MELHORIAS.md` (só as linhas do 12) | nada | todas |
| 1 | Lista fechada de motivos de "não medido" | `LIB/motivos-nao-medido.ts` (novo); `T/proprio-motivos-nao-medido.test.ts` (novo) | nada | todas |
| 2 | Faixa do YouTube: o número | `LIB/retencao-curva.ts`; `T/proprio-retencao-curva.test.ts` | nada | todas, menos 5 |
| 3 | Janela de 7 ou 30 dias com resposta vazia: uma tentativa (condicional à pergunta 1) | `src/lib/youtube/coleta/retencao-regra.ts`; `test/youtube/coleta/retencao-regra.test.ts` | *(emenda 1: D-I7)* resposta **explícita** do dono à pergunta 1 ("seguir o mockup"); **o lote E8-coleta ainda não enviado**, ou enviado e em `main` | todas |
| 4 | Leitor da retenção: histórico da vida e tentativas por janela | `LIB/ler-retencao.ts`; `T/proprio-ler-retencao.test.ts`; `T/proprio-ler-retencao-db.test.ts` | 2 (tipo); serial com a Tarefa 6 da E17 | 7, 8, 14, 15 |
| 5 | Modelo da seção Retenção com janelas (puro) | `APP/_proprio/curva-janelas-model.ts` (novo); `T/proprio-curva-janelas-model.test.ts` (novo) | 1, 2, 4; Tarefa 13 da E8 no HEAD | 7 a 15 |
| 6 | Componentes da seção Retenção | `APP/_proprio/curva-janelas.tsx` (novo, cliente); `APP/_proprio/curva-secao.tsx` (novo, servidor); `APP/_proprio/curva-janelas.css` (novo); `APP/_proprio/retencao-curva.tsx` e `.css` (da Tarefa 13 da E8); `T/proprio-curva-janelas-tela.test.tsx` (novo); `T/proprio-curva-css.test.ts` (novo) | 5; A4 em `staging` | 7 a 15 |
| 7 | Grupos e nomes: origem, aparelho, país, inscritos | `LIB/origem-grupos.ts` (novo); `LIB/pais-pt.ts` (novo); `T/proprio-origem-grupos.test.ts` (novo); `T/proprio-pais-pt.test.ts` (novo) | nada | todas |
| 8 | Agregação por período e estado por bloco (puro) | `LIB/origem-agregar.ts` (novo); `T/proprio-origem-agregar.test.ts` (novo); *(emenda 2: D-N1)* `LIB/na-conta.ts` (novo, puro) e `T/proprio-na-conta.test.ts` (novo). Dois commits: **(8a)** `na-conta.ts` e o teste dele (lote E5b-B; não depende de nada e pode começar já); **(8b)** o resto (lote E5b-O) | 1, 7 (só o 8b) | todas |
| 9 | Leitor do diário por período; entradas da origem e dos termos; varredura | `LIB/ler-diario-periodo.ts` (novo); `APP/_proprio/dados-origem.ts` (novo); `APP/_proprio/dados-termos.ts` (novo); `T/proprio-ler-diario-periodo.test.ts` (novo); `T/proprio-dados-origem.test.ts` (novo); `T/proprio-dados-termos.test.ts` (novo); `T/proprio-varredura.test.ts`; `test/integration/a5-e5b-leitores.test.ts` (novo). *(emenda 1: S-I9)* `LIB/ler-dimensoes.ts` **não é tocado** (o ramo condicional saiu). *(emenda 1: S-I7)* Dois commits: **(9a)** `ler-diario-periodo.ts`, o teste dele e a linha dele na varredura (lote E5b-B); **(9b)** o resto (lote E5b-O) | 8 *(emenda 2: D-N1: o 9a precisa só do commit 8a)*; C-10 respondida; serial com as Tarefas 5 e 6 da E17 em `T/proprio-varredura.test.ts` | 5, 6, 14, 15 |
| 10 | Modelo de tela da origem (frases) | `APP/_proprio/origem-model.ts` (novo); `T/proprio-origem-model.test.ts` (novo) | 1, 7, 8 | 5, 6, 9, 14, 15 |
| 11 | Componentes da origem | `APP/_proprio/origem.tsx` (novo, servidor); `APP/_proprio/origem-periodos.tsx` (novo, cliente); `APP/_proprio/origem-esqueleto.tsx` (novo); `APP/_proprio/origem.css` (novo); `T/proprio-origem-tela.test.tsx` (novo); `T/proprio-origem-css.test.ts` (novo) | 10; A4 em `staging` | 5, 6, 14, 15 |
| 12 | Cartão "Só o seu canal mede": cinco linhas | `APP/_comparar/so-seu-canal-model.ts`; `APP/_comparar/so-seu-canal.tsx`; `APP/_comparar/comparar.css`; `APP/_proprio/carregar-extras.ts`; `T/proprio-a4-so-seu-canal.test.tsx`; `T/proprio-a4-so-seu-canal-dados.test.ts`; `T/proprio-a4-so-seu-canal-seguranca.test.tsx`; `T/proprio-carregar-extras.test.ts` | 9, 10; A4 em `staging`; serial com a Tarefa 6 da E17 em `carregar-extras.ts` | 5, 6, 14, 15 |
| 13 | "Ainda cedo": regra e bloco de impressões | `LIB/cedo.ts` (novo); `APP/_proprio/impressoes-model.ts`; `APP/_proprio/impressoes.tsx`; `APP/_proprio/impressoes.css`; `T/proprio-cedo.test.ts` (novo); `T/proprio-impressoes.test.tsx` | A4 em `staging` (a regra pura `cedo.ts` e o teste dela podem começar já) | todas, menos 16 |
| 14 | % assistido por período: regra (puro) | `LIB/assistido-periodo.ts` (novo); `T/proprio-assistido-periodo.test.ts` (novo) | nada | todas |
| 15 | % assistido por período: cartões e aba Retenção do canal | `APP/_proprio/assistido-periodo-model.ts` (novo); `APP/_proprio/assistido-periodos.tsx` (novo, cliente); `APP/_proprio/assistido-periodo.css` (novo); `APP/_proprio/retencao-model.ts`; `APP/_proprio/retencao.tsx`; `APP/_proprio/retencao.css`; `T/proprio-assistido-periodo-tela.test.tsx` (novo); `T/proprio-retencao-model.test.ts`; `T/proprio-retencao-tela.test.tsx` | 14; A4 em `staging` | 5 a 13 |
| 16 | **Integração na página do vídeo** (a única que toca estes arquivos): quatro commits em série, um por tela | `APP/_proprio/dados.ts`; `APP/video/[id]/page.tsx`; `APP/_proprio/video-blocos-model.ts`; `APP/_proprio/video-blocos.tsx`; `APP/_proprio/video-blocos.css`; `T/proprio-dados.test.ts`; `T/proprio-video-blocos-model.test.ts`; `T/proprio-video-blocos.test.tsx`; `T/proprio-video-rota.test.ts`; `T/proprio-video-seguranca.test.tsx`; `T/proprio-video-tela.test.tsx` | 6, 9, 11, 13, 15; A4 em `staging`; `git status` limpo nestes arquivos | nenhuma que toque `video-blocos*`, `dados.ts` ou a página (E8 T13, E18, E17 T6) |
| 17 | **Integração na página do canal** (a única que toca estes arquivos) | `APP/canal/[id]/page.tsx`; `APP/_proprio/proprio-screen.tsx`; `APP/_proprio/view-model.ts`; `APP/_proprio/como-esta-model.ts`; `APP/_proprio/proprio.css`; `T/proprio-rota.test.ts`; `T/proprio-como-esta.test.ts`; `T/proprio-canal-seguranca.test.tsx`; *(emenda 1: S-I1)* `src/lib/youtube/observatorio/links.ts` (o tipo `CanalTab`); `APP/_canal/params.ts` (`TABS_PROPRIO`); `T/canal-params.test.ts`. *(emenda 1: S-I7)* Dois commits: **(17a)** aba Retenção com os três períodos; **(17b)** aba Origem | 11, 15, 16 | nenhuma que toque a página do canal (E17 T6) |
| 18 | Semente, capturas, revisão de UX, validação autenticada | `e2e/fixtures/observatorio-seed.ts`; `e2e/tests/cms/observatorio/proprio-e5b.spec.ts` (novo; *(emenda 2: S-n1)* a primeira versão escrevia `e2e/proprio-e5b.spec.ts`, fora de `testDir: './e2e/tests'` e do `testMatch` do projeto do Observatório em `playwright.config.ts:21,57`: o Playwright não o rodaria); `docs/superpowers/mockups/2026-10-13-a5-lote-2/e5b-shots/**` (novo, fora do commit de código); `.superpowers/sdd/a5-e5b/REVISAO-UX-IMPLEMENTADO.md` (novo) | 16, 17; lote C no banco local `bythiago_int`; `git status` limpo na semente | nenhuma que toque a semente |
| 19 | Envio e conferências | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts`; `.superpowers/sdd/a5/conferencias-com-data.md` | *(emenda 1: S-m3)* o código (com as quatro datas nulas) vai no primeiro lote enviado; cada data é preenchida no commit do envio do seu lote; seção 11 | nenhuma que toque `conferencias.ts` |

**Ondas.** Onda 1 (já): 0, 1, 2, 7, 14, e as regras puras de 8 (o commit 8a inteiro; emenda 2: D-N1) e 13. Onda 2 (A4 em `staging`, Tarefa 13 da E8 feita): 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15. Onda 3 (serial): 16, depois 17. Onda 4: 18, depois 19.

**Arquivos compartilhados com outras etapas** (uma etapa por vez: arquivo limpo no `git status`, commit por caminho, a segunda parte do commit da primeira):

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `LIB/retencao-curva.ts` | E8 (Tarefa 12a, feita) | só a Tarefa 2 daqui |
| `LIB/ler-retencao.ts` | E17 Tarefa 6 (troca o token; 5 linhas) | só a Tarefa 4 daqui. A guarda é uma função só (`siteAutorizado`): as consultas novas não citam o token, então a troca da E17 continua sendo de 5 linhas em qualquer ordem |
| `LIB/ler-dimensoes.ts` | E17 Tarefa 6 | *(emenda 1: S-I9)* **este plano não toca** |
| `src/lib/youtube/observatorio/links.ts`, `APP/_canal/params.ts` | A4 | *(emenda 1: S-I1)* só a Tarefa 17 daqui (commit 17b): um valor a mais em `CanalTab` e em `TABS_PROPRIO`; a lista `TABS` do concorrente não muda |
| `coleta/retencao-regra.ts` | E8 (Tarefa 8, feita) | só a Tarefa 3, condicional |
| `APP/_proprio/dados.ts`, `video/[id]/page.tsx`, `canal/[id]/page.tsx`, `carregar-extras.ts` | A4, E6 P2, E8 T13, E17 T6, E18 | só as Tarefas 16, 17 e 12; cada uma confere `git status` antes |
| `APP/_proprio/video-blocos-model.ts`, `video-blocos.tsx` | A4, E8 T13, E18 | só a Tarefa 16 |
| `APP/_proprio/retencao-curva.tsx` e `.css` | E8 T13 (cria) | só a Tarefa 6, depois da T13 |
| `APP/_proprio/impressoes-model.ts`, `retencao-model.ts`, `como-esta-model.ts`, `view-model.ts`, `proprio-screen.tsx` | A4 | Tarefas 13, 15 e 17, uma por arquivo |
| `APP/_proprio/header-model.ts` | A4, E8 T13 | **este plano não toca** |
| `T/proprio-varredura.test.ts` | E17 T5 e T6, E9, E8 | só a Tarefa 9 daqui; só acréscimos |
| `e2e/fixtures/observatorio-seed.ts` | A4 (com alteração sem commit em 13/10), E6, E8 T13, E9, E18 | só a Tarefa 18, depois de `git status` limpo; perfis novos com nomes novos (`curva-janelas`, `origem`, `cedo`, `assistido-periodo`), sem tocar o perfil `retencao` |
| `src/lib/conferencias.ts` | todas | um bloco por etapa; só a Tarefa 19 |
| `LIB/ler.ts`, `LIB/edicao.ts`, `LIB/tipos.ts`, `LIB/assistido.ts`, `LIB/dias.ts`, `LIB/dimensoes-estado.ts`, `reporting/codigos.ts`, `coleta/index.ts`, `types/database.types.ts`, `lib/observatorio/rules.ts` | várias | **este plano não toca** (os limiares novos ficam nos módulos novos, como a A4 fez) |

**Restrições globais.** TypeScript estrito, sem `any` e sem `as unknown as` novo (`bash scripts/check-type-debt.sh`). Arquivos em kebab-case. Texto que o dono lê em português, copiado da tabela de frases do mockup. Modelos puros sem React, sem banco e sem relógio (a data de hoje entra por parâmetro). Testes de modelo e de leitor com `// @vitest-environment node`; testes de componente com `// @vitest-environment jsdom`; nenhum sanitizador sob happy-dom. Datas de teste relativas ou com relógio falso (nenhum ano futuro digitado). Nenhum `next/link` nem componente importado passado como propriedade a componente cliente: componente cliente que precise de link importa o `Link` dentro do próprio módulo, ou usa `_shared/cms-link.tsx`. Nenhum `color-mix()`. Nenhum texto de exceção, termo de pesquisa, endereço de site ou país junto de vídeo e dia vai ao Sentry: só contagens e códigos. Nenhuma tarefa roda `next dev`, Playwright ou banco 54321/54322 sem liberação do controlador (zona da A4); a única que usa navegador é a 18, em subagente Sonnet. Commit sempre `git add <arquivos>` e `git commit -m … -- <os mesmos arquivos>`; nunca `git add -A`, `git stash`, `git reset`.

**Foco de revisão** (o que os dois especialistas devem atacar primeiro): (1) a regra "dia medido é o dia inteiro" e o fecho "total = soma + omitido" (Tarefa 8); (2) os três níveis de acesso e a entrada separada dos termos, nas duas ordens em relação à E17 (Tarefa 9); (3) a leitura em trechos e os tetos (Tarefa 9, 5.4); (4) a precedência dos estados de cada janela, com a fronteira de datas (Tarefa 5); (5) o número da faixa e o arredondamento (Tarefa 2); (6) a mudança condicional na regra da coleta (Tarefa 3); (7) o "canal inteiro" lido do diário e o teto da C-10 (Tarefas 9 e 14).

---

## 10. As tarefas

Formato de cada uma: arquivos (os da seção 9), contrato, testes escritos **antes** do código e vistos falhar, provas por mutação, armadilhas, pronto quando. Nenhuma traz código de produção inteiro.

### Tarefa 0: congelar os mockups, rodar as conferências, atualizar o roteiro (controlador)

**Passos.** (1) `git add` das duas pastas de mockup **sem** `shots/` e commit `docs:`; cópia de `11b-…/` e `12-…/` (sem `shots/`) e de `2026-10-13-a5-lote-1/{a-ainda-cedo.html,a.js,b-assistido-periodo.html,b.js,a4.css,a4-comum.js,lote.css,lote.js,LEIAME.md}` para `.superpowers/sdd/a5-e5b/mockup-congelado/`. (2) Rodar C-1 a C-16 *(emenda 1)* e anotar cada resultado em `.superpowers/sdd/a5-e5b/progress.md`. (3) No roteiro, trocar "em ajuste" e "Sem registro de aprovação" do 12 pela linha de aprovação de 13/10. (4) Levar ao dono as 20 perguntas da seção 1 *(emenda 1)*; anotar as respostas em `.superpowers/sdd/a5/decisoes-do-dono.md`.
**Pronto quando:** o ledger tem as 16 conferências com resultado ou com "não rodada, motivo"; a cópia congelada existe; a C-10 tem resposta (ela decide a Tarefa 9).

### Tarefa 1: lista fechada de motivos de "não medido"

**Contrato** (`LIB/motivos-nao-medido.ts`, puro).
```ts
export type MotivoNaoMedido =
  | 'coleta_comeca_em' | 'coleta_nao_comecou' | 'antes_da_coleta' | 'janela_aberta' | 'janela_fechou_antes'
  | 'janela_desistida' | 'ainda_nao_existe' | 'youtube_sem_curva' | 'nao_coletada' | 'em_revisao'
  | 'relatorio_nao_chegou' | 'busca_falhou' | 'dia_nao_chegou' | 'poucas_views' | 'coleta_desligada'
  | 'cobertura_parcial'   // (emenda 1: D-I1, S-I3) a coleta roda e nenhum dia do período tem todos os vídeos medidos
export const MOTIVOS_NAO_MEDIDO: Readonly<Record<MotivoNaoMedido, { origem: 'spec-6.1.5' | 'mockup-11b' | 'mockup-12' | 'lote-1' | 'plano-e5b' }>>
```
Só o catálogo e a origem de cada motivo. As frases ficam nos modelos de tela (Tarefas 5, 10, 13, 15), que tipam o campo `motivo` com `MotivoNaoMedido`.
**Testes.** `todo motivo tem origem`; `a lista tem exatamente os 16 nomes` *(emenda 1: D-I1, S-I3; eram 15)* (trava acréscimo sem decisão); `nenhum motivo de origem plano-e5b além de coleta_nao_comecou, janela_desistida, coleta_desligada e cobertura_parcial` (os quatro textos novos, que passam pelo revisor de UX). A frase de `cobertura_parcial`, a conferir pelo revisor de UX: "Em nenhum dia do período todos os vídeos foram medidos: faltam {N} de {M} vídeos."
**Pronto quando:** testes verdes.

### Tarefa 2: faixa do YouTube: o número

**Contrato** (`LIB/retencao-curva.ts`).
```ts
export const CORTE_ABAIXO = 0.45
export const CORTE_ACIMA = 0.55
export function zonaDaFaixa(valorDuasCasas: number): 'acima' | 'na-media' | 'abaixo'   // < 0,45 abaixo; > 0,55 acima; senão na-media
// LeituraBase ganha:
relativaValor: number | null   // mediana dos pontos com valor, arredondada a duas casas; null quando relativa é null
// CurvaCompleta ganha:
fim: number                    // o ratio do último ponto (t = 1,00)
```
`relativa` passa a ser `relativaValor === null ? null : zonaDaFaixa(relativaValor)`. A regra "menos da metade dos pontos com o campo = `null`" não muda. As constantes `LIMITE_ACIMA` e `LIMITE_ABAIXO` saem (o arredondamento a duas casas decide). *(emenda 1: S-I6)* **A folga `EPS` fica:** ela também é usada em `acharRevistos` (`retencao-curva.ts:135`, `subida >= SUBIDA_MIN_REVISTO - EPS`), regra aprovada na E8 e com teste próprio (`proprio-retencao-curva.test.ts:273`, "subida de exatamente 0,02 conta"); a primeira versão mandava apagá-la e quebraria essa regra em silêncio. *(emenda 1: S-m1)* **Regra do arredondamento, escrita:** `relativaValor = Math.round(mediana × 100 + EPS) / 100`, isto é, o empate na terceira casa sobe (como o `round` de `numeric` do Postgres, usado na K1 e na K6), em vez de ficar entregue à representação binária.
**Testes, antes do código** (em `proprio-retencao-curva.test.ts`).
- `fixture yJl (233 views): relativaValor 0,56 e zona acima`; `fixture eibJk0L8zzc vida: 0,54 e na média`; `fixture FHIgdLOzODE vida: 0,34 e abaixo` (lidos das fixtures reais em `.superpowers/sdd/a5/c0-fixtures/`, copiadas para `test/youtube/coleta/fixtures/retencao/` se ainda não estiverem; a conta esperada está em F9).
- Fronteira: `mediana 0,5549 arredonda para 0,55 e é na média`; `mediana 0,5551 arredonda para 0,56 e é acima`; `mediana 0,4451 arredonda para 0,45 e é na média`; `mediana 0,4449 arredonda para 0,44 e é abaixo`; `exatamente 0,45 e exatamente 0,55 são na média`; `mediana 0,5509 é na média` (com a regra antiga, sobre o valor cru, dava "acima": é o teste que falha primeiro). *(emenda 1: S-m1)* Empate, que a produção terá (a mediana de 100 pontos é a média de dois vizinhos): `pontos do meio 0,55 e 0,56: mediana 0,555 arredonda para 0,56 e é acima`; `pontos do meio 0,44 e 0,45: mediana 0,445 arredonda para 0,45 e é na média`.
- Dado ausente: `nenhum ponto com relative: relativaValor null e relativa null`; `49 de 100 pontos com relative: null`; `50 de 100: tem valor`; `relative nulo nunca entra como zero` (uma curva com 60 valores de 0,8 e 40 nulos dá 0,80, não 0,48).
- `curva parcial não tem fim` (prova de tipo: `@ts-expect-error` ao ler `fim` de `CurvaParcial`).
- Os testes de `relativa` que já existem e ficam perto da fronteira são atualizados **neste mesmo commit**. *(emenda 1: S-I6)* Só os de `relativa`: nenhum teste de `revistos` muda.
**Prova por mutação.** (a) Classificar pela mediana crua em vez do valor arredondado: o teste de 0,5509 cai. (b) Trocar `>` por `>=` no corte de cima: o teste de exatamente 0,55 cai. (c) Tratar `relative` nulo como 0: o teste dos 60 valores de 0,8 cai.
**Pronto quando:** testes verdes; *(emenda 1: S-I6)* `grep -n "LIMITE_ACIMA\|LIMITE_ABAIXO" LIB/retencao-curva.ts` vazio; os testes de trechos revistos (inclusive o da linha 273) verdes **sem mudança**.

### Tarefa 3: janela de 7 ou 30 dias com resposta vazia: uma tentativa (condicional)

*(emenda 1: D-I7)* **Só roda com a resposta explícita do dono "seguir o mockup" à pergunta 1.** No silêncio ou com "continuar tentando", registrar "não executada" no ledger: a coleta fica como está e a Tarefa 5 usa a frase alternativa. O que esta tarefa custa, se rodar: uma resposta vazia que seria passageira (relatório de retenção ainda não fechado) vira "sem curva" para sempre naquela janela.
**Contrato** (`coleta/retencao-regra.ts`, laço das janelas). Hoje: lê quando `tent === null || semRespostaNaJanela || vencida`. Passa a: `tent === null || semRespostaNaJanela`. Uma janela com resposta (`ok` já tem linha e sai antes; `sem_dado_na_janela` é a resposta vazia) não é buscada de novo. A tentativa **sem** resposta (erro) continua sendo repetida até `fim + 45`.
**Testes, antes do código.** `janela de 7 dias com resposta vazia há 8 dias: não entra em ler` (hoje entra: é o teste que falha primeiro); `…há 40 dias: não entra`; `janela com tentativa em erro e sem resposta: entra` (não regrediu); `janela nunca tentada, fechada e com a fonte em dia: entra`; `resposta vazia seguida de erro mais novo: entra` (o erro mais novo é uma tentativa sem resposta); `a vida inteira com resposta vazia continua relida com views novas e 7 dias` (a regra da vida não mudou).
**Efeito no orçamento do cron.** Só diminui chamadas (no máximo 2 por vídeo a cada 7 dias a menos). Os tetos e o relógio não mudam.
**Armadilhas.** Se o lote E8-coleta já tiver sido enviado mas não promovido, esperar a promoção: o commit desta tarefa não pode entrar no meio da lista de commits de outro lote. O desvio 16 do plano da E8 (que explicou a releitura) ganha uma linha no ledger daquela etapa, escrita pelo controlador.
**Pronto quando:** testes verdes; `test/youtube/coleta/retencao-step.test.ts` verde sem mudança.

### Tarefa 4: leitor da retenção: histórico da vida e tentativas por janela

**Contrato** (`LIB/ler-retencao.ts`; `RetencaoDoVideo` ganha três campos, nenhum sai).
```ts
export const TETO_HISTORICO = 26
/** leituras de `vida` COM pontos: as TETO_HISTORICO mais recentes e, se não estiver entre elas, a mais antiga; da mais nova para a mais velha */
historicoVida: CurvaLida[]
/** há leituras de `vida` que ficaram fora do histórico (entre a mais antiga e as mais recentes) */
historicoCortado: boolean
/** por janela: a última tentativa (qualquer resultado) e a última em que a API respondeu */
tentativas: Record<Janela, { ultima: { dia: string; resultado: string } | null; ultimaResposta: { dia: string; resultado: 'ok' | 'sem_dado_na_janela' } | null }>
```
- Duas consultas a mais em `yt_own_video_retention`, com os **mesmos quatro filtros** de `doVideo` (site, canal, vídeo, `segment = 'organico'`) e `window_kind = 'vida'`: as mais recentes (`order window_end desc, collected_at desc`, 26 linhas) e a mais antiga (`order window_end asc, collected_at asc`, 1 linha).
- *(emenda 1: D-I3, S-I5)* **Uma consulta de tentativas por tipo**, três em paralelo (`retencao_vida`, `retencao_7d`, `retencao_30d`), cada uma com os mesmos filtros de site, canal, `scope_type = 'video'` e `scope_id`, cada uma com o seu `TETO_TENTATIVAS` (30), a sua busca à parte da "última com resposta" (quando as 30 mais novas daquele tipo são todas falha) e a regra "a mais nova ilegível lança" aplicada por tipo. O molde já existe no arquivo ("uma por janela", linhas 172 a 175). A primeira versão pedia uma consulta só com `.in('kind', …)` e teto de 90: como a ordem é por dia e a vida inteira é tentada todo dia enquanto falha, 90 falhas da vida esconderiam a única resposta vazia de 7 dias e o cartão passaria de "o YouTube não devolveu curva" para "não foi buscada a tempo", que é falso. `ultimaTentativa` e `ultimaResposta` (da vida) continuam existindo, com o mesmo valor de antes, para o modelo da Tarefa 13 da E8.
- Leitura do histórico em forma ruim: é descartada, `descartados++`; se for a **mais recente**, a janela já está em `janelasIlegiveis` (não muda). Tentativa com `kind` fora dos três: descartada e contada.
- Tabela ausente: os três campos novos vêm vazios (`[]`, `false`, e as três janelas com `null`), junto do `tabelaAusente` de hoje.
**Testes, antes do código** (banco falso em `proprio-ler-retencao.test.ts`; banco de verdade em `-db.test.ts`, com `describe.skipIf(skipIfNoLocalDb())`).
- `três leituras de vida: historicoVida traz as três, da mais nova para a mais velha, com pontos`.
- `30 leituras: traz as 26 mais recentes e a mais antiga, historicoCortado verdadeiro`; `27 leituras: 26 mais a mais antiga, cortado falso`; `uma leitura: uma, sem duplicar`.
- Dado ausente: `nenhuma leitura: histórico vazio e tentativas nulas nas três janelas`; `tabela ausente: idem, com tabelaAusente`; `sem token: negado e zero consultas` (conta as chamadas do falso); `nenhuma tentativa de 7 dias e uma de 30: 7 dias nulo, 30 preenchido`.
- `tentativas separadas por janela: erro em 7 dias não aparece na vida`; `resposta vazia seguida de erro: ultima é o erro, ultimaResposta é a vazia`.
- *(emenda 1: D-I3, S-I5)* `100 falhas diárias da vida, todas mais novas que a única resposta vazia de 7 dias: a de 7 dias aparece e o estado dela continua sem-dado` (falha com o desenho de uma consulta só); `31 falhas de 30 dias e uma resposta mais antiga: a busca de reserva daquele tipo a encontra`; `a tentativa mais nova de 7 dias ilegível lança, mesmo com a da vida legível`; `as três consultas levam o filtro de kind` (o banco falso registra).
- `leitura antiga com ponto fora de 0 a 1: descartada, contada, e as outras ficam`.
- `erro de banco na consulta do histórico é lançado`.
- Banco de verdade: os mesmos três primeiros, mais `outro site com o mesmo vídeo não aparece` e `outro canal do mesmo site não aparece`.
**Provas por mutação pedidas** (o relatório lista, por consulta nova, o teste que caiu): tirar `.eq('site_id', …)` da consulta do histórico e da mais antiga; tirar `.eq('channel_id', …)`; tirar `.eq('youtube_video_id', …)`; tirar `.eq('scope_id', …)` de cada uma das três de tentativas; *(emenda 1: D-I3, S-I5)* tirar o `.eq('kind', …)` de uma delas (o teste das 100 falhas cai); tirar `.eq('window_kind', 'vida')` (uma leitura de 7 dias entraria no histórico). Se faltar teste de site ou de canal cruzado para alguma, ele é escrito aqui, antes da mutação.
**Armadilhas.** Não trocar a guarda `siteAutorizado` nem citar o token nas consultas novas (0.3). Não ler `points` na lista geral (`leituras` continua sem pontos).
**Pronto quando:** testes verdes nos dois arquivos; a varredura `proprio-varredura.test.ts` verde sem mudança.

### Tarefa 5: modelo da seção Retenção com janelas (puro)

**Contrato** (`APP/_proprio/curva-janelas-model.ts`).
```ts
export const VIEWS_MIN_CURVA_FIRME = 500          // pergunta 4: provisório, revisão na conferência e5b-d28
export const NA_MEDIA_PONTOS_CURVA = 2
export type EstadoJanela = 'lida' | 'aberta' | 'antes' | 'sem-dado' | 'erro-sem' | 'nao-coletada' | 'novo' | 'desistida' | 'ilegivel' | 'falha-de-leitura' | 'privada'
export interface EntradaCurva {
  retencao: Privado<RetencaoDoVideo>; durSeg: number | null; publicadoEm: DiaYt | null
  hojePt: DiaYt; hojeUtc: string; janelasDesde: DiaYt        // RETENCAO_JANELAS_DESDE, passado por quem chama
  dm(dia: string): string; dmy(dia: string): string
}
export interface CartaoJanela { janela: Janela; rotulo: string; rotuloCurto: string; estado: EstadoJanela; legenda: string; linha: string; mini: number[] | null; aviso: boolean }
export interface CorpoLido { curva: PontoCurva[]; primeira: PontoCurva[] | null; meioSeg: number | null; faixa: FaixaView | null; mudou: MudouView | null; leituras: LeituraView[] | null; saidas: string[] | null; revistos: string[] | null; poucas: boolean; notas: string[]; erroComLeitura: string | null; tabela: Array<{ tempo: string; pct: string }> }
export interface JanelaView { cartao: CartaoJanela; frase: string; chips: string[]; avisos: string[]; corpo: { tipo: 'lida'; dado: CorpoLido } | { tipo: 'sem-curva'; motivo: MotivoNaoMedido | null; texto: string; progresso: { dia: number; de: number; faltam: number } | null; alerta: string | null } }
export interface CurvaJanelasView { acesso: 'ok' | 'negado' | 'erro'; padrao: 'vida'; janelas: Record<Janela, JanelaView>; lembranca: string; bloqueio: string[] | null; metodoJanela: string[]; metodoFaixa: string[] }
export function buildCurvaJanelas(a: EntradaCurva): CurvaJanelasView
```
**Precedência do estado de cada janela** (N = 7 ou 30; `fim` = publicação + N − 1; `fechaEm` = publicação + N). A primeira regra que casar vale:
1. `acesso = 'negado'` → `privada` nas três. `acesso = 'erro'` → `falha-de-leitura` nas três.
2. `tabelaAusente` → a vida é `nao-coletada`. *(emenda 1: S-m9)* Nas de 7 e 30 dias vale só o calendário: `publicadoEm` nulo → `nao-coletada`; `hojePt < fechaEm` → `aberta`; `fim < janelasDesde` → `antes`; senão `nao-coletada`. A primeira versão punha as três em `nao-coletada`, e a janela de um vídeo antigo, que nunca será coletada, leria "Ainda não coletamos".
3. a janela está em `janelasIlegiveis` → `ilegivel`.
4. há `curvas[janela]` → `lida`. `erroComLeitura` quando a última tentativa da janela não é benigna e é de dia posterior ao da coleta da curva.
5. **só 7 e 30 dias**, com `publicadoEm` nulo → `nao-coletada`, sem data.
6. **só 7 e 30 dias:** `hojePt < fechaEm` → `aberta`; senão `fim < janelasDesde` → `antes`; senão última resposta `sem_dado_na_janela` → `sem-dado`; senão `hojePt > fim + 45` → `desistida`; senão última tentativa não benigna → `erro-sem`; senão `nao-coletada`. *(emenda 1: D-I4, S-I4)* `desistida` passou a vir **antes** de `erro-sem`: a coleta abandona a janela em `fim + 45` com ou sem erro anterior (`retencao-regra.ts:211`), e na ordem da primeira versão a tela diria "Tentamos de novo em {hoje}" todo dia, para sempre, sem ninguém tentar. `sem-dado` continua antes, porque a resposta vazia é fato definitivo. *(emenda 2: D-n1)* A frase, não: "a frase segue verdadeira depois dos 45 dias" valia para a do mockup ("buscada uma vez só"), e o padrão da pergunta 1 é a alternativa ("Tentamos de novo uma vez por semana…"), que depois de `fim + 45` descreve uma tentativa que ninguém faz mais. Por isso o estado continua `sem-dado` e o **painel** muda depois de `fim + 45` (tabela de textos abaixo).
7. **só a vida:** última resposta `sem_dado_na_janela` (mesmo com erro mais novo) → `sem-dado`; senão última tentativa não benigna → `erro-sem`; senão sem tentativa e vídeo com menos de 5 dias (`RETENCAO.videoNovoDias`) → `novo`; senão `nao-coletada`.

**Textos.** Todos vêm da tabela "Frases da tela (texto exato)" de `…/11b-retencao-janela-e-faixa/NOTAS.md`, linha por linha; a tarefa copia, não redige. Mapa:

| Estado | Frase do topo | Linha do cartão | Painel |
|---|---|---|---|
| `lida`, cruza | "Nos primeiros 7 dias / Nos primeiros 30 dias / Na vida inteira do vídeo, metade das pessoas já saiu aos m:ss (N% do vídeo)." | "Metade saiu aos m:ss" e "Leitura de dd/mm" | curva, faixa, listas |
| `lida`, nunca cruza | "…, mais da metade das pessoas ficou até o fim." | "Mais da metade fica até o fim" | idem |
| `lida`, curva incompleta | o texto da Tarefa 13 da E8 ("não dá para dizer"; "Curva com N pontos.") | "Curva com N pontos" | curva, sem listas, sem "como mudou" |
| `aberta` | "[Janela]: a janela ainda não fechou." | "fecha em dd/mm" | "Fecha em dd/mm (faltam N dias). A curva dessa janela é buscada uma vez, quando ela fecha." e "dia N de M" |
| `antes` | "[Janela]: a janela não existe para este vídeo." | "fechou antes da coleta" | "Ela fechou em dd/mm/aaaa, antes de começarmos a coletar. Não buscamos curvas do passado, então essa janela não volta." |
| `desistida` (pergunta 15) | a de `antes` | "não foi buscada a tempo" | "Ela fechou em dd/mm/aaaa e não conseguimos buscá-la nos 45 dias seguintes. Essa janela não volta." |
| `sem-dado` | "O YouTube não devolveu curva para este vídeo (poucas views)." | "sem curva do YouTube" | "Tentamos em dd/mm." mais, na vida: "Tentamos de novo quando o vídeo tiver views novas, no máximo uma vez por semana."; em 7 e 30 dias: *(emenda 1: D-I7)* "Tentamos de novo uma vez por semana, até 45 dias depois de a janela fechar." (o padrão da pergunta 1); "Esta janela é buscada uma vez só." só se a Tarefa 3 tiver rodado. *(emenda 2: D-n1)* Em 7 e 30 dias, com `hojePt > fim + 45` e sem a Tarefa 3: "Tentamos até dd/mm e o YouTube não devolveu curva. Essa janela não volta.", em que dd/mm é o dia da última tentativa gravada daquela janela (`tentativas[janela].ultima.dia`), no lugar das duas frases (texto novo, para o revisor de UX) |
| `erro-sem` | "A curva ainda não foi buscada." | "falhou em dd/mm" | aviso "A primeira tentativa falhou em dd/mm. Tentamos de novo em dd/mm; você não precisa fazer nada." e "Ainda não há leitura para mostrar." |
| `nao-coletada` | "Ainda não coletamos esta curva." | "ainda não coletada" | "Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam." |
| `novo` | "Vídeo novo: a primeira leitura vem nos próximos dias." | "primeira leitura em breve" | "Quando ela chegar, esta seção mostra onde as pessoas saem do vídeo e onde voltam." |
| `ilegivel`, `falha-de-leitura` | "A leitura da curva falhou agora; recarregue a página." (texto da Tarefa 13 da E8) | "falha de leitura" | a mesma frase |
| `privada` | "Você não vê esta curva." | "Curva privada" e "só quem edita vê" | as duas frases do bloqueio do mockup |

- **Chips de `lida`:** "Leitura de dd/mm"; "N views na janela" (só com `viewsAtRead` conhecido e não poucas); "▲ A curva passa de 100%: muita gente voltou e reviu o vídeo." (pico acima de 1,0001); "Só N views: leia como indício, não como medida." (poucas).
- **Poucas views:** `viewsAtRead !== null && viewsAtRead < VIEWS_MIN_CURVA_FIRME`, ou `viewsAtRead === null` (com a frase sem número da pergunta 4). Com poucas: `saidas` e `revistos` nulos e a nota "Com tão poucas views a curva balança: não marcamos maiores saídas nem trechos revistos."; a faixa ganha "Só N views: leia como indício."
- **Listas:** "Maiores saídas" e "Trechos revistos" como na Tarefa 13 da E8; lista vazia de curva completa lê "nenhuma saída marcada" e "nenhum trecho revisto" (zero medido: caixa vazada com 0 no componente).
- **Faixa:** `relativaValor` com duas casas e vírgula; zona de `zonaDaFaixa`; `relativaValor` nulo → "Sem a comparação do YouTube. O YouTube não devolveu a comparação com vídeos de duração parecida nesta leitura."
- **"Como a curva mudou desde dd/mm":** só na vida, com a mais antiga e a mais recente do `historicoVida`, as duas completas. *(emenda 1: D-m8)* E as duas firmes: se uma das duas leituras é de poucas views ("indício"), não há comparação e a nota diz "Uma das duas leituras tinha poucas views: não comparamos." (texto novo, para o revisor de UX). Três linhas, todas sobre os números **arredondados que aparecem**: metade (diferença em m:ss; até 2 pontos do vídeo é "quase igual (até 2 pontos do vídeo)"; 0 é "igual"; senão "+m:ss mais tarde" ou "−m:ss mais cedo"), fim (`round(fim × 100)`; "+N pontos mais gente até o fim", "−N pontos menos gente até o fim", "quase igual (até 2 pontos)", "igual"), comparação ("subiu de faixa", "desceu de faixa", "mesma faixa"; com um dos dois nulo, "sem a comparação do YouTube"). Quando um dos lados nunca cruza 50%: a célula diz "mais da metade fica até o fim" e a coluna "Mudou" diz "igual" (os dois), "passou a ficar mais gente" ou "passou a sair mais gente" (dois textos novos, para o revisor de UX).
- **"Ver as N leituras":** N = quantas leituras de vida existem (`leituras` filtrado); uma linha por item do `historicoVida`, com "mais recente" na primeira; com `historicoCortado`, a nota "mostrando a primeira e as 26 mais recentes".
- **Notas:** em 7 e 30 dias lidas: "Esta janela é buscada uma vez só, quando fecha: ela não muda depois."; na vida com uma leitura: "Só há uma leitura (dd/mm). “Como a curva mudou” aparece a partir da segunda."
- **Próxima tentativa** (desvio 8): `max(dia da falha + 1, hojeUtc)`.
- **Duração nula ou zero:** todo "m:ss" vira "N% do vídeo".

**Testes, antes do código** (`proprio-curva-janelas-model.test.ts`). Um teste por linha da tabela de textos, comparando a frase **inteira**. Mais:
- Fronteira de datas, com a publicação em função de `janelasDesde`: `último dia da janela de 7 dias na véspera de janelasDesde: antes`; `no próprio janelasDesde: não é antes`; `hoje igual a fechaEm − 1: aberta, faltam 1 dia`; `hoje igual a fechaEm: não é aberta`; `hoje igual a fim + 45: nao-coletada`; `fim + 46: desistida`; *(emenda 1: D-I4, S-I4)* `erro na última tentativa e hoje = fim + 45: erro-sem`; `erro na última tentativa (em fim + 44) e hoje = fim + 46: desistida, e a vista inteira não contém "Tentamos de novo"`; `resposta vazia e hoje = fim + 46: sem-dado`; *(emenda 2: D-n1)* `resposta vazia, hoje = fim + 46, Tarefa 3 não rodou: o painel diz "Tentamos até {dia da última tentativa}" e "Essa janela não volta", e a vista não contém "Tentamos de novo"`; `resposta vazia e hoje = fim + 45: o painel ainda diz "Tentamos de novo uma vez por semana"`; `publicado hoje: aberta, dia 0 de 7` (a fórmula do mockup; o revisor de UX olha).
- Dado ausente: `negado: nenhuma das três janelas tem número, data, pontos nem mini` (o JSON da vista não contém nenhum dígito do sentinela 73519 nem das datas da fixture); *(emenda 1: S-m9)* `tabela ausente, vídeo antigo: vida nao-coletada, 7 e 30 dias antes`; `tabela ausente, vídeo publicado ontem: 7 e 30 dias aberta`; `tabela ausente, janela fechada depois de janelasDesde: nao-coletada`; `publicação nula: 7 e 30 sem data`; `viewsAtRead nulo: poucas, com a frase sem número`; `duração nula: nenhum "0:00" na vista inteira`; `histórico com uma leitura: mudou é nulo e a nota aparece`; *(emenda 1: D-m8)* `a mais antiga com 200 views e a mais nova com 900: mudou é nulo e a nota de poucas views aparece`; `relative ausente: faixa com o texto de sem comparação`.
- Precedência: `sem-dado vence erro mais novo na vida`; `ilegivel vence tudo menos negado e tabela ausente`; `lida com erro posterior: erroComLeitura preenchido e a curva continua`.
- Contas: `metade 35% de 6:00 = 2:06`; `diferença de fim 47 contra 51 = +4 pontos`; `49 contra 51 = quase igual`; `faixa 0,62 → 0,44: desceu de faixa`.
- `499 views: poucas; 500: não` (a constante é importada, não digitada).
- `nenhum texto de não medido fora de MotivoNaoMedido` (o campo `motivo` é tipado; o teste confere que todo `sem-curva` tem `motivo` não nulo, menos `privada` e as duas de falha).
**Armadilhas.** Não recalcular a zona da faixa aqui. Não formatar data com `new Date()` do sistema (a data de hoje entra por parâmetro). Não importar nada de `server-only`.
**Pronto quando:** testes verdes; o arquivo não importa React.

### Tarefa 6: componentes da seção Retenção

**Contrato.**
- `curva-janelas.tsx` (`'use client'`): `CurvaJanelas({ cartoes, conteudos, padrao, lembranca }: { cartoes: CartaoJanela[]; conteudos: Record<Janela, ReactNode>; padrao: Janela; lembranca: string })`. `role="radiogroup"` com três `role="radio"` (um só no Tab; setas esquerda, direita, cima e baixo trocam; Home e End vão ao primeiro e ao último). Escolha: `?janela=7|30|vida` da URL vence; senão o salvo em `localStorage` (`obs-proprio-curva-janela`, em `try/catch`, lido depois da montagem); senão `padrao`. A linha "Salvo neste navegador · Voltar ao padrão (vida inteira)" só aparece quando a escolha salva não é o padrão. Região `aria-live="polite"` só com a frase-resumo, e só em troca feita pela pessoa. Mostra **um** filho por vez.
- `curva-secao.tsx` (servidor): recebe `CurvaJanelasView`, monta os três conteúdos (frase e chips antes do seletor, faixa, curva, "como mudou", `<details>` das leituras, listas, painéis sem curva, aviso de erro, bloqueio) e entrega a `CurvaJanelas`. Com `acesso = 'negado'` os três conteúdos são o bloqueio e os cartões são os de cadeado.
- `retencao-curva.tsx` (da Tarefa 13 da E8): o teto do eixo passa a `max(1,2; teto(pico + 0,04, uma casa))`, com a linha de grade de 140% quando o teto chega a 1,4; aceita `primeira` (a leitura mais antiga) desenhada tracejada por baixo. A legenda "pico de N% no começo" da E8 sai onde o eixo passou a mostrar o pico.
- `curva-janelas.css`: as classes do mockup (`rj-sel`, `rj-c`, `rj-fx`, `rj-rg`, `rj-mt`, `rj-nmp`, `rj-erro`, `rj-lock`), copiadas de `11b.css`; a 390 px os rótulos curtos ("7 dias", "30 dias", "Vida toda") e três colunas.
**Testes, antes do código** (`proprio-curva-janelas-tela.test.tsx`, jsdom).
- `os três cartões são rádios, um só com tabindex 0`; `seta direita troca a janela e a região anuncia a frase nova`; `Home e End`.
- `?janela=30 vence o que está salvo`; `sem URL, o salvo é aplicado depois de montar`; `valor salvo inválido é ignorado`; `localStorage que lança não quebra a tela` (o `getItem` do teste lança: a tela fica no padrão).
- `a linha "Salvo neste navegador" não aparece no padrão e aparece com 7 dias salvo`; `Voltar ao padrão apaga a chave`.
- `só o conteúdo da janela escolhida está no DOM`.
- Faixa: `valor 0,62: marca em 62% da régua, zona acima em negrito, texto "Acima de vídeos de duração parecida", selo "cálculo do YouTube"`; `0,02 e 0,97: a etiqueta fica dentro da régua` (a posição é limitada como no mockup); `sem valor: o texto de sem comparação e nenhuma régua`.
- `zero trechos revistos: caixa com 0, nunca a hachura`; `curva com pico 1,3: o caminho não sai da área e a grade de 140% existe`; `nenhum SVG de curva nos estados sem curva`.
- **Segurança:** `negado: o HTML não tem nenhum dígito do sentinela, nenhuma data da fixture, nenhum <svg class="cv-…">, e nenhum atributo title, aria-label ou data-* com número`; os cartões dizem "Curva privada".
- `proprio-curva-css.test.ts`: `curva-janelas.css não contém color-mix(`; `as três zonas têm cor literal`.
- Item 241 (C-13): se o teste dos símbolos de direção existir, `curva-secao.tsx` entra na lista de componentes permitidos, com a anotação "aprovado pelo dono no 11b, pergunta 12".
**Armadilhas.** `curva-janelas.tsx` não importa modelo com dado, leitor nem `server-only`; recebe só nós já renderizados e os cartões (que, para `negado`, não têm número). Nenhum `next/link` como propriedade. O primeiro HTML traz a janela da URL ou o padrão; a troca para o valor salvo acontece no efeito, para o HTML do servidor e o do cliente baterem.
**Pronto quando:** testes verdes; os testes da Tarefa 13 da E8 (`proprio-retencao-curva-tela.test.tsx`) atualizados no mesmo commit onde o eixo mudou.

### Tarefa 7: grupos e nomes: origem, aparelho, país, inscritos

**Contrato** (`LIB/origem-grupos.ts`, puro).
```ts
export type GrupoOrigem = 'pesquisa' | 'sugeridos' | 'navegacao' | 'shorts' | 'externa' | 'outras'
export const ORDEM_ORIGEM: readonly GrupoOrigem[]   // a ordem fixa do mockup
export const ROTULO_ORIGEM: Record<GrupoOrigem, { nome: string; de: string }>  // "Pesquisa do YouTube" / "da pesquisa do YouTube" …
export function grupoDaOrigem(valor: string): { grupo: GrupoOrigem; catalogado: boolean }   // aceita o nome da API e o código do lote
export type GrupoAparelho = 'celular' | 'computador' | 'tv' | 'tablet' | 'outros'
export function grupoDoAparelho(valor: string): { grupo: GrupoAparelho; catalogado: boolean }   // "MOBILE|ANDROID" e o código do lote
export function grupoDeInscrito(valor: string): 'inscritos' | 'nao_inscritos' | null
```
Tabela (pergunta 8): `pesquisa` = `YT_SEARCH`, `5`; `sugeridos` = `RELATED_VIDEO`, `7`, `32`; `navegacao` = `SUBSCRIBER`, `3`; `shorts` = `SHORTS`, `24`; `externa` = `EXT_URL`, `9`; `outras` = todo o resto do catálogo `ORIGEM_LOTE` (`catalogado: true`) e todo valor fora do catálogo (`catalogado: false`). Aparelho: `MOBILE`/`104` celular; `DESKTOP`/`101` computador; `TV`/`102` tv; `TABLET`/`105` tablet; `GAME_CONSOLE`, `UNKNOWN_PLATFORM` e desconhecidos em `outros`. Só a parte antes de `|` decide.
`LIB/pais-pt.ts`: `nomeDoPais(iso: string): { nome: string; de: string }`. O nome vem de `Intl.DisplayNames(['pt-BR'], { type: 'region' })`; a forma com preposição ("do Brasil", "dos Estados Unidos", "da Argentina", "de Portugal") vem de uma tabela de artigos para os países da lista da tarefa (lusófonos, Américas, Europa e Ásia mais prováveis, 60 ou mais); país fora da tabela usa "de {nome}". `ZZ` → "Não identificado" / "de país não identificado". Código inválido → `{ nome: código, de: 'de ' + código }`, sem lançar.
**Testes.** `os seis grupos com um valor de cada, pelo nome da API e pelo código`; `código que não existe: outras, catalogado falso`; `string vazia e nulo tratado como desconhecido, nunca lança`; `todo código de ORIGEM_LOTE cai em algum grupo` (percorre o catálogo real); `MOBILE|ANDROID e MOBILE|IOS são celular`; `aparelho sem barra`; `inscritos: SUBSCRIBED, UNSUBSCRIBED, outro valor nulo`; país: `BR: Brasil, do Brasil`; `US: dos Estados Unidos`; `PT: de Portugal`; `AR: da Argentina`; `NL: dos Países Baixos`; `país fora da tabela: de {nome}` (o teste nomeia o padrão); `ZZ`; `"xx" inválido não lança`.
**Pronto quando:** testes verdes; a tabela de grupos conferida contra o resultado da C-4 quando ele existir (uma linha no ledger).

### Tarefa 8: agregação por período e estado por bloco (puro)

**Contrato** (`LIB/origem-agregar.ts`).
```ts
export const MARCA_DE_CONTAGEM: DiaYt = '2026-08-24'     // pergunta 10
export type EstadoBloco = 'medido' | 'zero' | 'nao_medido' | 'em_revisao'
export interface Cobertura { dias: number; medidos: number; de: DiaYt; ate: DiaYt; primeiroMedido: DiaYt | null; ultimoMedido: DiaYt | null; desde: DiaYt | null; cruzaMarca: boolean }
export interface LinhaBloco<K extends string> { chave: K; valor: number; pct: number; semNumero: boolean }   // semNumero: valor 0 com omitido > 0
export interface BlocoAgregado<K extends string> { estado: EstadoBloco; motivo: MotivoNaoMedido | null; conjunto: EstadoConjunto; cobertura: Cobertura; total: number; soma: number; omitido: number; pctOmitido: number; linhas: LinhaBloco<K>[]; naoCatalogados: number; diasEmRevisao: number; videosNaConta: number; videosFora: number; faltamNoPiorDia: number; videosParados: number; paradosDesde: DiaYt | null }   // (emenda 1: D-I1, S-I3) videosNaConta, videosFora e faltamNoPiorDia; (emenda 2: D-N1) os dois últimos: quantos pararam e o menor "último dia medido" entre eles
export function agregarBloco<K extends string>(p: { conjunto: ConjuntoLido<LinhaBasica>; de: DiaYt; ate: DiaYt; publicacoes: ReadonlyMap<string, DiaYt | null>; chaveDe(valor: string): { chave: K; catalogado: boolean } | null; ordem: readonly K[] | 'por-valor'; maxLinhas?: number; resto?: K }): BlocoAgregado<K>
export function maiorResto(valores: readonly number[]): number[]      // inteiros que somam 100; lista vazia ou soma 0 devolve zeros
export function pctTexto(pct: number, valor: number): string         // "<1%" quando valor > 0 e pct === 0
export function diasMedidosEmComum(a: Cobertura, b: Cobertura): boolean   // os dois blocos cobrem exatamente os mesmos dias
// (emenda 2: D-N1) LIB/na-conta.ts, puro, commit 8a; usado por agregarBloco e por totalDoPeriodo (Tarefa 9)
export const DIAS_SEM_LEITURA = 8      // o mesmo número de DIAS_DE_ATRASO_ANTIGO (coleta/diario-step.ts:30, que não é exportado)
export interface NaConta { exigidoAte: ReadonlyMap<string, DiaYt>; fora: readonly string[]; parados: readonly string[]; paradosDesde: DiaYt | null }
export function quemEstaNaConta(p: { ytIds: readonly string[]; de: DiaYt; ate: DiaYt; ultimoMedido(ytId: string): DiaYt | null }): NaConta
```
**Regras.**
1. **Dia medido:** *(emenda 1: D-I1, S-I3)* antes de tudo, o vídeo que não tem **nenhum** dia com `coberto` e `baseMedida` no período inteiro sai da conta e é contado em `videosFora` (os outros são `videosNaConta`); com `videosNaConta = 0` o bloco é `nao_medido` pelo motivo do conjunto; *(emenda 2: S-n4)* quando o conjunto é `coletado` (que não tem motivo próprio), o motivo é `cobertura_parcial`, com `faltamNoPiorDia = videosFora`, e a página **do vídeo** usa frase própria ("Este vídeo não tem nenhum dia medido no período.", Tarefa 10), porque "faltam 1 de 1 vídeos" é frase de canal. *(emenda 2: D-N1)* Quem decide "fora", "parado" e "na conta" é `quemEstaNaConta` (4.3), chamada com o último dia do período em que o vídeo tem `coberto` e `baseMedida`: sem nenhum, `fora`; último dia anterior a `ate − DIAS_SEM_LEITURA`, `parado`, exigido só até esse dia (`exigidoAte`); senão exigido até `ate`. `videosNaConta` conta os exigidos (parados incluídos); `videosParados` e `paradosDesde` vão para a tela. *(emenda 1: S-m4)* Vídeo com publicação nula conta como publicado em todos os dias: nunca some da regra por falta de data (só sai pela regra do vídeo sem dia medido). Depois, para cada dia do período, olham-se os vídeos da conta já publicados naquele dia *(emenda 2: D-N1)* e ainda exigidos nele (dia menor ou igual ao `exigidoAte` do vídeo); dia em que nenhum vídeo é exigido **não é medido** (sem isso, "todos" de um conjunto vazio seria verdadeiro). O dia é medido se, e só se, **todos** têm `coberto` e `baseMedida` verdadeiros e nenhuma linha do dia tem contagem nula. Dia em que algum vídeo está `antesDoInicio`, fora da cobertura ou sem a referência não é medido.
2. **Em revisão:** se em algum dia medido alguma célula (vídeo, dia) tem `emRevisao`, o bloco inteiro é `em_revisao`, `linhas` vem vazia e `diasEmRevisao` conta os dias. Nenhuma divisão é mostrada.
3. **Total** = soma de `base` nos dias medidos (base nula com `baseMedida` conta 0). **Soma** = soma das contagens das linhas nos dias medidos. **Omitido** = total − soma, nunca negativo (negativo só existe em revisão, tratado em 2).
4. **Estado:** `medidos = 0` → `nao_medido`, com o motivo tirado de `conjunto.estado` e das datas (`coleta_comeca_em`, `coleta_nao_comecou`, `relatorio_nao_chegou` para os conjuntos de lote, `coleta_desligada`, `busca_falhou`); *(emenda 1: D-I1, S-I3)* com `conjunto.estado = 'coletado'` e `medidos = 0` o motivo é **sempre** `cobertura_parcial`, com `faltamNoPiorDia` (quantos vídeos da conta faltaram no dia em que mais faltaram), e nunca `coleta_nao_comecou`; `total = 0` → `zero`; senão `medido`.
5. **Linhas:** agrupadas por `chaveDe`; valor que `chaveDe` devolve `null` é ignorado **e contado** (só acontece em inscritos com valor desconhecido; vai para `naoCatalogados`). Com `ordem` fixa, toda chave aparece, mesmo com 0. Com `'por-valor'` (país), as `maxLinhas` maiores e o resto somado em `resto`.
6. **Porcentagem:** `maiorResto` sobre `[...linhas, omitido]`; a soma é sempre 100 quando `total > 0`.
7. **Cobertura:** `dias` = dias de calendário de `de` a `ate`; `cruzaMarca` = `de < MARCA_DE_CONTAGEM <= ate`.
**Testes, antes do código.**
- Fecho: `soma das linhas mais o omitido é igual ao total, em 200 casos gerados` (gerador com semente fixa); `as porcentagens somam 100 em todos`; `valor 3 de 826: "<1%", nunca "0%"`.
- Dado ausente: `nenhum vídeo: nao_medido`; `nenhum dia coberto: nao_medido, motivo coleta_comeca_em quando a data de partida é futura`; `data de partida passada e nada coberto: coleta_nao_comecou`; `conjunto de lote sem cobertura: relatorio_nao_chegou`; `schema_ausente: nao_medido`; `dia coberto com total 0: zero`; `dia com a referência não medida: sai dos medidos, não vira zero`; `linha com contagem nula: o dia sai dos medidos`; **`apagar a cobertura de um dia que tinha linhas: o dia sai dos medidos e as linhas dele não entram na soma`** (o teste apaga e afirma).
- `canal com dois vídeos, um coberto e outro não no dia D: o dia D não é medido`; `vídeo ainda não publicado no dia D não conta para a regra`.
- *(emenda 1: D-I1, S-I3)* `34 vídeos cobertos e 1 sem nenhum dia medido no período: o bloco é medido, videosFora 1, videosNaConta 34, e o total é a soma dos 34`; `35 vídeos, cada um medido em dias diferentes, nenhum dia em comum, conjunto coletado: nao_medido com cobertura_parcial e faltamNoPiorDia maior que 0, nunca coleta_nao_comecou`; `conjunto coletado com zero dias medidos nunca lê coleta_nao_comecou` (percorre os casos gerados); `todos os vídeos sem dia medido e conjunto nao_coletado: o motivo do conjunto`; *(emenda 2: S-n4)* `todos fora e conjunto coletado: nao_medido com cobertura_parcial, faltamNoPiorDia igual a videosFora, nunca motivo nulo`.
- *(emenda 2: D-N1)* `quemEstaNaConta` (`proprio-na-conta.test.ts`): `sem nenhum dia medido: fora`; `último dia medido em ate − 8: exigido até ate`; `em ate − 9: parado, exigido só até esse dia`; `período de 7 dias: ninguém é parado, qualquer que seja o último dia`; `lista vazia: tudo vazio, sem lançar`; `DIAS_SEM_LEITURA é o número escrito em coleta/diario-step.ts` (o teste lê o código do arquivo; se a coleta mudar o dela, este cai).
- *(emenda 2: D-N1)* No agregador: `35 vídeos, um com leitura só até o dia 10 de um período de 90: os dias 11 a 90 continuam medidos com os outros 34, videosParados 1 e paradosDesde o dia 10; o bloco nunca fica em "Medido em 10 de 90 dias" sem a contagem`; `o mesmo vídeo com a última leitura há 5 dias: os dias depois dela não são medidos e videosParados é 0` (só atrasado); `página do vídeo, um vídeo parado: medido até o último dia dele, e nenhum dia depois é medido` (o caso do conjunto vazio); `o total do bloco com um vídeo parado é a soma dos 35 até o dia 10 e dos 34 depois`.
- *(emenda 1: S-m4)* `vídeo com publicação nula e coberto: conta em todos os dias`; `vídeo com publicação nula e sem cobertura num dia D: o dia D não é medido`.
- `uma célula em revisão: bloco em_revisao, linhas vazias, diasEmRevisao 1`.
- `valor 0 com omitido maior que 0: semNumero verdadeiro`; `valor 0 com omitido 0: semNumero falso` (zero de verdade).
- `código desconhecido de origem entra em outras e conta em naoCatalogados; a soma fecha`.
- `país: 9 países, maxLinhas 6: seis linhas e "outros" com a soma dos três`.
- Marca: `período que começa em 23/08 e termina em 25/08: cruza`; `começa na própria data da marca: não cruza`; `termina na véspera: não cruza`.
- `diasMedidosEmComum: mesmas datas verdadeiro; um dia a mais falso`.
**Prova por mutação** *(emenda 2: D-N1)*. Tirar a regra do parado (exigir todo vídeo até `ate`): o teste dos 35 vídeos cai. Tirar a guarda do dia sem vídeo exigido: o teste da página do vídeo cai. Trocar `<` por `<=` no corte dos 8 dias: o teste de `ate − 8` cai.
**Pronto quando:** testes verdes; o módulo não importa nada além de `dimensoes-estado`, `motivos-nao-medido`, `na-conta` *(emenda 2: D-N1)* e tipos; `na-conta.ts` não importa nada além de tipos.

### Tarefa 9: leitor do diário por período; entradas da origem e dos termos; varredura

**Antes de começar:** a resposta da C-10. *(emenda 1: D-I6, S-I8)* Acima de **10.000** linhas com `views > 0` (eram 60.000), **para e avisa** (o "Canal inteiro" sai deste envio).
**Contrato.**
- `LIB/ler-diario-periodo.ts` (`server-only`): `lerDiarioDoPeriodo(sb, p: Pedido & { ytIds: readonly string[]; de: DiaYt | null; ate: DiaYt; soComViews: boolean; publicacoes: ReadonlyMap<string, DiaYt | null>; tetoLinhas?: number }): Promise<Privado<DiarioDoPeriodo>>`, com `DiarioDoPeriodo = { canalId; de; ate; linhas: Array<{ ytId; dia; views: number | null; pctAssistido: number | null }>; foraDoTeto: readonly string[]; descartados: number; cobertura: { conhecida: boolean; videosCompletos: number; videosIncompletos: number; primeiroDiaLido: DiaYt | null; intervalos: ReadonlyMap<string, ReadonlyArray<{ de: DiaYt; ate: DiaYt }>> } }` *(emenda 2: D-N1: `intervalos` são os intervalos `base` por vídeo, para o total de qualquer trecho da leitura; as duas contagens continuam, e valem para a leitura inteira)*. *(emenda 1: D-I2)* **O leitor lê também a cobertura**, porque depois da dieta (MG15) dia sem atividade não tem linha e "dia coberto com zero" e "dia não coletado" ficam iguais no diário: (a) `ate` é **recebido** de quem chama e é o `ultimoDia` do `lerDiario` tolerante (4.4), nunca "o último dia com linha" achado aqui, para os "28 dias" desta tela e os da A4 na mesma página serem os mesmos; (b) uma consulta a mais lê os intervalos `base` de `yt_own_video_coverage` dos mesmos vídeos, com os mesmos filtros de site, canal e vídeo; um vídeo é "completo" quando os intervalos cobrem todos os dias de `max(de, publicação)` a `ate` (com `de` nulo, desde a publicação; publicação nula = incompleto, porque não se sabe); (c) tabela de cobertura ausente: `conhecida: false`, um aviso ao Sentry, e nenhum total é afirmado; (d) *(emenda 2: D-N1; a primeira versão era `totalDoPeriodo(d): number | null`, sem período, e exigia todos os vídeos da leitura inteira)* função pura exportada `totalDoPeriodo(d, p: { de: DiaYt | null; ate: DiaYt }): { total: number | null; videosNaConta: number; videosFora: number; videosParados: number; paradosDesde: DiaYt | null; comBuraco: number }`. Ela aplica `quemEstaNaConta` (Tarefa 8, commit 8a) aos dias com cobertura `base` de cada vídeo **dentro de `[de, ate]`**: vídeo sem nenhum dia coberto no trecho é `fora`; vídeo com a cobertura parada há mais de 8 dias é exigido só até o último dia coberto; `comBuraco` conta os vídeos da conta com algum dia sem cobertura entre `max(de, publicação)` e o seu `exigidoAte` (publicação nula conta como buraco). `total` é a soma das views dos vídeos da conta, cada um até o seu `exigidoAte`, e é **nulo** quando a cobertura não é `conhecida`, quando `comBuraco > 0` ou quando `videosNaConta = 0`. Quem mostra total usa só ela, e mostra junto a contagem ("de 34 dos 35 vídeos") sempre que `videosFora + videosParados > 0`. O percentual assistido não depende da cobertura (só entra dia com view). *(emenda 1: D-I6)* A paginação ordena por `youtube_video_id, day_pt` (a chave primária), para não haver linha repetida nem perdida entre páginas. Mesma guarda de `ler.ts` (sem prova, ou canal que não é uuid: `negado` **sem consultar**); filtros de site **e** canal **e** vídeo; `de = null` quer dizer "desde o começo" e exige `soComViews = true` (senão lança antes de consultar); leitura paginada; teto padrão *(emenda 1: D-I6, S-I8)* 10.000 linhas (10 páginas), acima lança `ObservatoryLoadError`; até 50 vídeos por chamada (o resto volta em `foraDoTeto`, nunca em silêncio; a entrada da origem chama em lotes de 50, pergunta 20); valores negativos e percentual fora de 0 a 999,99 viram nulo e contam em `descartados`.
- `APP/_proprio/dados-origem.ts` (`server-only`): `lerOrigem(a: { canalId: string; ytIds: readonly string[]; de: DiaYt; ate: DiaYt; agora: number; prova: ProvaPrivada | null }): Promise<Privado<OrigemLida>>`, com `OrigemLida = { dimensoes: DimensoesCanal; diario: DiarioDoPeriodo; diarioInteiro: DiarioDoPeriodo | null; trechos: number }`. *(emenda 2: S-n6)* **Esta entrada é quem lê os dois diários da origem**, com o mesmo `ytIds`, em lotes de 50, e para isso a assinatura ganha `diarioDesde: DiaYt` (o primeiro dia do período curto mais largo: `ate − 89` no canal, `ate − 6` no vídeo; `de` e `ate` continuam sendo a janela das dimensões): `diario` cobre de `diarioDesde` a `ate`, e `diarioInteiro` é `lerDiarioDoPeriodo` com `de: null` e `soComViews: true`, de onde sai o total de "Desde {ano}" e de "Desde a publicação". A página não chama o leitor (a varredura proíbe) e não reaproveita `lerDiarioLongo`, que lê outro conjunto de vídeos (`ownYtIds`). Falha ou teto estourado **só** no `diarioInteiro`: ele volta `null`, com um aviso ao Sentry, o total do período longo lê "não medido" e o grupo continua; falha no `diario` curto é erro do grupo, como as dimensões. `ProvaPrivada` é o tipo do campo de `Pedido` no HEAD (`EdicaoDoSite` hoje; `LeituraPrivadaDoSite` depois da Tarefa 6 da E17). Chama `lerDimensoes` em trechos de até 120 dias e lotes de até 50 vídeos, no máximo 2 chamadas em voo e **12 por leitura** (acima lança; *(emenda 1: S-m7)* o 12 conta chamadas a `lerDimensoes`: trechos de data vezes lotes de vídeos, então 60 vídeos em 300 dias são 6); *(emenda 1: D-I1, S-I3)* quando algum bloco agregado volta com `videosFora > 0` ou `cobertura_parcial`, a página avisa o Sentry uma vez por requisição, só com as duas contagens *(emenda 2: S-n5: quem agrega é o modelo, não esta entrada; o aviso é do contrato de `OrigemDoVideo` e de `OrigemDoCanal`, Tarefas 16 e 17, com teste lá, e passa a disparar também com `videosParados > 0`)*; junta os trechos por conjunto e por vídeo; o estado do conjunto é o do trecho mais recente. Erro de qualquer trecho: `{ acesso: 'erro' }` e **um** aviso ao Sentry (`component: 'observatorio-proprio'`, `step: 'ler-origem'`, com o motivo e o código, sem conteúdo). Sem prova: `negado`, sem criar o cliente de serviço.
- `APP/_proprio/dados-termos.ts` (`server-only`): `lerTermosESites(a: { canalId: string; ytIds; de; ate; agora; prova: ProvaPrivada | null }): Promise<Privado<DetalheCanal>>`. *(emenda 1: S-I10)* **Sem `siteId` na assinatura:** o site vem de dentro do token (`a.prova.siteId`, o getter de `edicao.ts:31`), e é a edição **desse** site que é provada aqui dentro (`provarEdicao(a.prova.siteId)`). Assim ninguém junta a edição de um site com a leitura de outro, que é para o que o token existe (cabeçalho de `edicao.ts`). Sem prova de leitura, ou sem a de edição: `negado`, sem consultar e sem criar o cliente de serviço. Com as duas, chama `lerDetalheDaOrigem` em trechos, como acima. Enquanto a E17 não está no HEAD o token de leitura já é o de edição e a segunda prova é a mesma guarda.
- *(emenda 1: S-I9)* **O ramo condicional da primeira versão saiu.** `ler-dimensoes.ts` não é tocado em nenhuma das duas ordens: escrever `EdicaoDoSite` ou `edicaoValida` nele deixaria vermelha a varredura que a Tarefa 6 da E17 instala. A barreira dos termos é uma só, `dados-termos.ts`, e o que a segura é a regra de varredura abaixo ("`lerDetalheDaOrigem(` só em `dados-termos.ts`") mais os testes de sentinela das Tarefas 11, 16 e 17. Fica dito, sem suavizar: depois da E17 o leitor `lerDetalheDaOrigem`, chamado direto com o token de leitura, entrega os termos; quem impede a chamada direta é a varredura, não o leitor.
- **Varredura** (`proprio-varredura.test.ts`, só acréscimos, cada regra com o seu controle negativo): `dados-origem.ts` e `dados-termos.ts` entram em `PODE_LER`; `dados-termos.ts` entra em `PODE_PROVAR` *(emenda 1: S-I9: serial com a mudança da E17 nessa mesma constante, depois dela se ela já estiver no HEAD, com o controle negativo de lá intacto)*; `lerDimensoes(`, `lerDetalheDaOrigem(` e `lerDiarioDoPeriodo(` fora de `LIB`, `dados.ts`, `dados-origem.ts` e `dados-termos.ts` são violação; **`lerDetalheDaOrigem(` em qualquer arquivo que não seja `dados-termos.ts` nem `ler-dimensoes.ts` é violação** *(emenda 2: S-n3: a definição do leitor mora em `ler-dimensoes.ts:400` e a regra, ao pé da letra, acusava o próprio arquivo)*; importar `dados-termos` de um componente cliente é violação; `yt_own_video_traffic_detail_daily` citado em `src/app/api/` é violação.
**Testes, antes do código.**
- Leitor do diário: *(emenda 1: D-I6)* `duas páginas com a mesma chave na fronteira: nenhuma linha repetida nem perdida` (o falso devolve na ordem de `youtube_video_id, day_pt` e o teste afirma a ordem pedida); `sem token: negado e zero consultas`; `objeto forjado: negado`; `canal que não é uuid: negado sem consultar`; `de nulo sem soComViews: lança antes de consultar`; `soComViews filtra views > 0 na consulta` (o falso registra o filtro); `mais de 1.000 linhas: pagina`; `passa do teto: lança`; `51 vídeos: 50 lidos e 1 em foraDoTeto`; `lista de vídeos vazia: linhas vazias, sem consultar o diário`; `views negativas viram nulo e contam`; `erro de banco é lançado`.
- `dados-origem`: `período de 7 dias: um trecho`; `período de 300 dias: três trechos, juntados sem dia repetido nem dia faltando` (conta os dias); `60 vídeos: dois lotes`; `13 trechos: lança e vira erro com um aviso`; `um trecho falha: erro, um aviso só`; `sem prova: negado e o construtor do cliente de serviço não é chamado`; `início depois do fim: o RangeError do leitor vira erro, com um aviso, e nunca lista vazia`; *(emenda 2: S-n6)* `o diário inteiro é lido com de nulo e soComViews, com os mesmos ytIds das dimensões`; `o diário inteiro passa do teto: diarioInteiro nulo, um aviso, e as dimensões e o diário curto continuam`; `60 vídeos: dois lotes em cada um dos dois diários`.
- `dados-termos`: `quem edita: lê`; `quem não edita: negado, sem cliente de serviço e sem consulta`; `a guarda de edição lança: negado, nada escapa` (`provarEdicao` engole o erro e devolve nulo, `edicao.ts:43-45`; quem transforma esse caso em bloco de erro para quem edita é a página, Tarefa 16); com a E17 no HEAD: `quem tem só o direito: negado`. *(emenda 1: S-I10)* `prova de leitura do site B e edição só do site A: negado, zero consultas e o cliente de serviço não é criado`; `a guarda é chamada com o site do token, nunca com outro` (o falso registra o argumento).
- *(emenda 1: D-I2)* Cobertura *(emenda 2: D-N1: nos testes da emenda 1, "totalDoPeriodo é a soma" e "nulo" passam a ler o campo `total`, com o trecho pedido igual à leitura inteira)*: `cobertura base cobre o período inteiro dos dois vídeos: totalDoPeriodo é a soma`; *(emenda 2: D-N1)* `buraco de cobertura de 40 a 20 dias atrás: o total de 7 dias é a soma e o de 90 é nulo, com comBuraco 1`; `35 vídeos, um sem nenhum dia coberto no trecho: o total é o dos 34, videosFora 1`; `um vídeo com a cobertura parada há 30 dias num trecho de 90: o total soma as views dele até o último dia coberto e as dos outros até o fim, videosParados 1 e paradosDesde esse dia, e não é nulo`; `o mesmo vídeo parado há 5 dias: total nulo` (só atrasado: é buraco); `todos fora: total nulo, nunca 0`; `um vídeo com 20 dias sem cobertura no meio do período: totalDoPeriodo nulo e videosIncompletos 1` (hoje daria um total menor, em silêncio); `tabela de cobertura ausente: conhecida falso e totalDoPeriodo nulo`; `dia coberto sem linha conta como zero no total` (o teste **apaga** as linhas de zero de um banco falso cheio e afirma o mesmo total e o mesmo percentual: é a prova de que o leitor funciona antes e depois da MG15); `ate é o recebido, mesmo quando a última linha é de semanas antes`; `a consulta da cobertura leva os filtros de site, canal e vídeo`.
- Integração (`test/integration/a5-e5b-leitores.test.ts`, `describe.skipIf(skipIfNoLocalDb())`, contra `bythiago_int` com MG14, MG5 e MG7 aplicadas pelo controlador): `diário de outro site não aparece`; `diário de outro canal do mesmo site não aparece`; `origem lida em dois trechos é igual à lida em um` (mesmo dado, janelas de 60 + 60 contra 120).
**Provas por mutação pedidas.** Em `ler-diario-periodo.ts`: tirar `.eq('site_id', …)`; tirar `.eq('channel_id', …)`; tirar `.in('youtube_video_id', …)`; trocar a guarda por `p.edicao != null`. Em `dados-termos.ts`: tirar a chamada a `provarEdicao` (o teste "quem não edita" cai); *(emenda 1: S-I10)* trocar `a.prova.siteId` por um site vindo de fora (o teste dos dois sites cai). *(emenda 1: D-I2)* Em `ler-diario-periodo.ts`: tirar o filtro de site ou de canal da consulta da cobertura; fazer `totalDoPeriodo` devolver a soma com vídeo incompleto; *(emenda 2: D-N1)* fazer `totalDoPeriodo` ignorar `de` e `ate` (o teste do buraco de 40 dias cai); somar as views do vídeo parado depois do `exigidoAte` dele. *(emenda 2: S-n6)* Em `dados-origem.ts`: transformar a falha do `diarioInteiro` em erro do grupo (o teste abaixo cai). Em `dados-origem.ts`: tirar o limite de 12 trechos. O relatório lista o teste que caiu em cada uma.
**Armadilhas.** `dados.ts` **não** é editado aqui (é da Tarefa 16 e da E17). O teste de integração só vai a push junto do lote em que as migrations que ele lê já estão em `supabase/migrations/`.
**Pronto quando:** testes de unidade e varredura verdes; integração verde no banco local; *(emenda 2: S-n3)* `grep -rn "lerDetalheDaOrigem(" apps/web/src | grep -v "_proprio/dados-termos.ts" | grep -v "proprio/ler-dimensoes.ts"` vazio (a primeira versão filtrava por `"LIB"`, que é abreviação deste plano e não existe em caminho nenhum: o resultado nunca seria vazio).

### Tarefa 10: modelo de tela da origem (frases)

**Contrato** (`APP/_proprio/origem-model.ts`, puro).
```ts
export type PeriodoCanal = '7' | '28' | '90' | 'tudo'
export type PeriodoVideo = '7' | 'tudo'
export type Nivel = 'tudo' | 'sem-termos' | 'so-aviso'          // 4.5
export interface EntradaOrigem { tela: 'video' | 'canal'; nivel: Nivel; origem: Privado<OrigemLida>; termos: Privado<DetalheCanal>; periodos: Array<{ id: string; rotulo: string; de: DiaYt; ate: DiaYt; totalDoPeriodo: number | null; videosDoTotal: { naConta: number; fora: number; parados: number; paradosDesde: DiaYt | null; comBuraco: number } | null }>;   // (emenda 2: D-N1) videosDoTotal vem do resultado de totalDoPeriodo; null = cobertura não conhecida
  publicadoEm: DiaYt | null; hojePt: DiaYt; ligadoEm: DiaYt; publicacoes: ReadonlyMap<string, DiaYt | null>; dm; dmy; n(x: number): string }
export interface OrigemView { nivel: Nivel; periodos: Array<{ id: string; rotulo: string; grupo: GrupoView }>; padrao: string; lembranca: string; dica: string }
export function buildOrigem(a: EntradaOrigem): OrigemView
```
`GrupoView` traz, por período, os blocos na ordem do mockup: origem (barra, lista, cobertura, rodapé), impressões por origem, termos e sites, aparelho, país, inscritos, cada um com `estado`, `frase`, `linhas`, `cobertura` em texto, `metodo` (o ⓘ) e, quando for o caso, `aviso`, `bloqueio` ou `erro`.
**Regras.**
- **Nível `so-aviso`** (pergunta 6): `periodos` vazio e um bloco só, "Dado que você não vê", com as duas frases do mockup e os sete blocos nomeados. Nenhum número. **Nível `sem-termos`:** tudo, menos o bloco de termos e sites, que vira o bloqueio "Você não vê este dado. Termos de pesquisa e sites de fora só aparecem para quem edita o site." mais "Aqui há duas listas que você não vê…". **Nível `tudo`:** os sete. *(emenda 1: S-m6, D-m4)* **`termos.acesso = 'erro'`**, ou `negado` para quem a página sabe que edita: o nível continua `tudo` e só o bloco de termos e sites vira erro ("Não conseguimos ler agora" e "Tentar de novo"); nunca "Nenhum termo apareceu" nem "Você não vê este dado". Para isso `EntradaOrigem` ganha `podeEditar: boolean`. *(emenda 2: S-n2)* Na página do canal ele é o `canEdit` de `_chrome/page-data.ts:90`; na do vídeo esse campo não existe, e a derivação está escrita na Tarefa 16.
- **`origem.acesso = 'erro'`:** grupo inteiro vira o bloco de erro (pergunta 14a), com `role="alert"`.
- **"Ainda não existe":** só na página do vídeo, quando `videoNovo(publicadoEm, hojePt)` (menos de 3 dias): todos os blocos com "Ainda não existe. O YouTube entrega a origem das views 2 a 3 dias depois da publicação. Primeira leitura em {publicação + 3}."
- **Por bloco**, a partir do `BlocoAgregado` da Tarefa 8: `nao_medido` → a frase do motivo, com "um texto por cartão" ("a origem", "o aparelho", "o país", "quem é inscrito"); `zero` → "Zero medido." e a frase do bloco; `em_revisao` → as duas frases do mockup, e os termos passam a "Sem comparar com o total da pesquisa: a origem está em revisão."; `medido` → frase, barra e lista.
- **Frase da origem:** com cobertura parcial, "Nos {N} dias medidos ({de} a {ate}), …"; com cobertura total, sem o prefixo. Com omitido acima de 50%: a frase "o YouTube disse a origem de só X views das Y, e Z foram omitidas…". Os dois grupos citados são os dois maiores.
- **Conjunto em erro ou desligado, com dias medidos** (pergunta 14b): os dias continuam e `aviso` leva "A última busca falhou em dd/mm. A tela mostra os dias medidos até dd/mm." ou "A coleta da origem está desligada."
- **Impressões por origem:** sem a linha "Sites e apps de fora"; impressões que cheguem nesse grupo entram em "Outras origens" (a soma fecha).
- **Termos e sites:** termo = linha de detalhe com `sourceType = '5'` e detalhe não vazio; site = `sourceType = '9'`. "Das {n} views da pesquisa: {a} com termo, {b} omitidas pelo YouTube." só quando `diasMedidosEmComum(origem, detalhe)`; senão "Sem comparar com o total da pesquisa: a origem foi medida em {N} dos {M} dias desta lista." Lista vazia com omitido na origem: "Nenhum termo apareceu. O YouTube só mostra termos que trouxeram várias views; as {n} views da pesquisa ficaram sem termo (omitido pelo YouTube)."; lista vazia com total 0 e omitido 0: "Zero medido".
- **País:** `dePais` vem de `nomeDoPais`; "Não identificado" só existe se houver linha `ZZ`.
- **Inscritos:** a faixa que lidera é a cheia.
- **Rodapé:** "Views no período todo: {n}. A divisão acima usa só as {n} views dos dias medidos." `totalDoPeriodo` nulo *(emenda 1: D-I2, D-m5: cobertura incompleta, leitura acima do teto ou tabela de cobertura ausente; não é mais o caso da C-11)* → o rodapé diz só a segunda frase. *(emenda 1: D-I1, S-I3)* Com `videosFora > 0`, o bloco ganha a linha "{N} de {M} vídeos fora desta conta: sem leitura no período." (texto novo, para o revisor de UX). *(emenda 2: D-N1)* Com `videosParados > 0`, a linha "{N} de {M} vídeos sem leitura depois de {paradosDesde}: os dias seguintes contam só os outros."; na página do vídeo, "Sem leitura depois de dd/mm." O total do período (a célula do topo e a primeira frase do rodapé) ganha "de {N} dos {M} vídeos" sempre que `fora + parados > 0`, e, com `totalDoPeriodo` nulo por buraco, a **célula** lê "não medido: {N} de {M} vídeos com o período inteiro medido", com N e M contados entre os vídeos da conta **daquele** período (o rodapé continua com uma frase só, como acima). *(emenda 2: S-n4)* Na página do vídeo, o bloco com `cobertura_parcial` e nenhum vídeo na conta diz "Este vídeo não tem nenhum dia medido no período." (texto novo, para o revisor de UX), nunca "faltam 1 de 1 vídeos". *(emenda 1: S-I2)* Este arquivo ganha também a função pura `videosDaOrigem(obs, canalId): string[]`, o conjunto da pergunta 20.
- **ⓘ:** os textos da tabela de frases; a linha de 24/08 só quando `cruzaMarca`; no estado não medido, "Quando a coleta começar, a soma das origens mais o omitido será igual ao total"; em revisão, "Aqui a soma das origens passou do total, por isso a divisão não aparece até conferir."; o ⓘ de termos traz "Quem vê: só quem edita o site. Nada disto sai do painel."
- **Rótulos de leitor de tela:** origem sem número: "{Origem}: sem número do YouTube, pode estar no omitido"; régua: "Origem medida em {N} de {M} dias, de {data} a {data}."

Todas as frases são as da seção 2 de `…/12-origem-das-views/NOTAS.md`; a tarefa copia.
**Testes, antes do código.** Um teste por linha da tabela de frases do mockup, com a frase inteira. Mais:
- Os estados da seção 10 e 11 da NOTAS, com os **mesmos números do mockup** como fixture: `típico, canal, 7 dias: 3.185 = 1.338 + 573 + 478 + 319 + 223 + 76 + 178 omitido; 42% e 18% na frase`; `magro: "só 5 views das 14, e 9 foram omitidas"`; `zero`; `não medido: "0 de 7" e a data`; `revisão: 826 contra 860`.
- Dado ausente: `origem negada: nível so-aviso sem nenhum número privado na vista` (a fixture leva o sentinela 73519, o termo "sentinela-termo-xyz" e o endereço "sentinela.example"; o JSON da vista não contém nenhum dos três, e o único número que sobra é o "7" de "7 blocos"); `termos negados com origem ok: bloco de bloqueio e os outros seis com número`; `totalDoPeriodo nulo: rodapé de uma frase`; *(emenda 1: S-m6, D-m4)* `termos em erro com origem ok: só o bloco de termos em erro, os outros seis com número, e a vista não contém "Nenhum termo apareceu" nem "Você não vê este dado"`; `termos negados e podeEditar verdadeiro: bloco de erro, não o de bloqueio`; `termos negados e podeEditar falso: bloco de bloqueio`; *(emenda 1: D-I1, S-I3)* `videosFora 1 de 35: a linha "1 de 35 vídeos fora desta conta" aparece`; `cobertura_parcial: a frase com N de M, e nenhuma ocorrência de "A coleta ainda não começou"`; *(emenda 2: D-N1, S-n4)* `videosParados 1 de 35: a linha "1 de 35 vídeos sem leitura depois de dd/mm" aparece no bloco`; `total de 34 dos 35 vídeos: a célula e o rodapé dizem "de 34 dos 35 vídeos"`; `total nulo por buraco em 90 dias e inteiro em 7: o de 7 mostra o número e o de 90 lê não medido com a contagem`; `página do vídeo, cobertura_parcial sem vídeo na conta: a frase própria, e a vista não contém "faltam 1 de 1"`; *(emenda 1: S-I2)* `videosDaOrigem inclui Short e vídeo não acompanhado e não inclui vídeo de outro canal`; `publicação nula: "Desde a publicação" não está em periodos`; `conjunto desligado sem dias: não medido com a frase da coleta desligada`.
- `nenhuma porcentagem aparece quando o bloco não é medido`.
- `o ⓘ só cita a marca de contagem em período que cruza`.
- `página do vídeo diz "este vídeo foi mostrado"; a do canal, "seus vídeos"`.
**Pronto quando:** testes verdes; o arquivo não importa React nem `server-only`.

### Tarefa 11: componentes da origem

**Contrato.**
- `origem.tsx` (servidor): `Origem({ view }: { view: OrigemView })`. Monta, por período, o grupo (barra de 40 px com `role="img"` e `aria-label` por extenso; lista que é legenda e tabela; régua de cobertura, com a faixa quebrada quando os dias antes da coleta passam de 60; cartões de aparelho, país e inscritos; bloco de termos e sites com o selo de cadeado) e entrega a `OrigemPeriodos`.
- `origem-periodos.tsx` (`'use client'`): `OrigemPeriodos({ opcoes, conteudos, padrao, lembranca, dica })`: lista de botões com `aria-pressed` dentro de `role="group"` com o rótulo "Período" (o mockup usa links com `aria-current`; aqui a troca não navega, então é botão: a mesma decisão da dívida B7); `?origem=` vence *(emenda 1: S-m2; era `?periodo=`)*; `localStorage` (`obs-proprio-origem-periodo`); "Escolha salva neste navegador. [Voltar ao padrão]"; alvo de 44 px. Traz também o botão "Tentar de novo" do bloco de erro, que chama `router.refresh()` e mostra "Tentando de novo…" em `role="status"`.
- `origem-esqueleto.tsx`: o estado "Carregando" do mockup (barra de 40 px com contorno, três linhas, rótulo "Carregando…"; sem hachura e sem pontilhado; a animação some com `prefers-reduced-motion`). É o `fallback` do `Suspense` das Tarefas 16 e 17.
- `origem.css`: as classes `ov-*` de `ov.css`, com cor literal.
**Testes, antes do código** (jsdom).
- `a barra tem role img e o rótulo lista cada origem com % e número`; `origem sem número diz "sem número do YouTube, pode estar no omitido", nunca "0% (0)"`; `a fatia do omitido é a última e tem a classe tracejada`.
- `valor sem número aparece com o símbolo do mockup e aria-label "sem número informado"`.
- `cobertura total: sem régua, só a linha de texto`; `cobertura parcial: régua`; `mais de 60 dias antes da coleta: faixa quebrada`.
- `o seletor troca o grupo sem navegar`; `?origem=90 vence o salvo`; *(emenda 1: S-m2)* `?assistido=28 na URL não muda o período da origem`; `localStorage que lança não quebra`; `valor salvo que não existe nesta tela (28 no vídeo) é ignorado`.
- `Tentar de novo chama refresh uma vez e mostra o texto de espera`.
- `esqueleto: nenhuma classe de hachura nem de pontilhado`.
- **Segurança:** `nível so-aviso: o HTML não contém o sentinela, o termo nem o endereço, em texto, title, aria-label ou data-*`; `nível sem-termos: contém os números da origem e NÃO contém o termo nem o endereço`; `o componente cliente não importa origem-model com dado, dados-origem nem dados-termos` (lê o código do arquivo, como `proprio-video-tela.test.tsx:308`).
- `origem.css não contém color-mix(`; `alvos do seletor com 44 px de altura mínima declarada`.
**Pronto quando:** testes verdes.

### Tarefa 12: cartão "Só o seu canal mede": cinco linhas

**Contrato.** `so-seu-canal-model.ts`: `ChaveLinha` ganha `'origem' | 'termos' | 'aparelho' | 'pais' | 'inscritos'`; `montarSoSeuCanalDado` recebe também `origem: Privado<OrigemLida>` e `termos: Privado<DetalheCanal>` de **7 dias** e monta as cinco linhas com os mesmos estados dos blocos (medido, zero, não medido, ainda não existe, bloqueado, erro, em revisão), usando `agregarBloco`. `FRASE_ABERTURA` passa ao texto do mockup: "Impressões, taxa de clique, origem das views e termos de pesquisa só chegam ao dono do canal." `carregar-extras.ts`: `carregarProprioDaComparacao` lê `lerOrigem` e `lerTermosESites` *(emenda 1: S-I2: com o mesmo conjunto de vídeos da aba Origem, `videosDaOrigem`, para os números do cartão baterem com os da página do canal)* **só para os canais próprios que estão no par**, no máximo 4 em voo; falha de um vira `{ acesso: 'erro' }` naquele canal e um aviso por requisição (o padrão de `lerAlcanceDosCanais`).
Valores: origem "{42%} da pesquisa do YouTube, {18%} de vídeos sugeridos" com a barra pequena; termos: a busca líder para quem edita, e "só para quem edita" com cadeado para os outros; aparelho "{62%} em celular"; país "{70%} do Brasil"; inscritos "{58%} de quem não é inscrito". Erro: "Não conseguimos ler agora". Em revisão: `aria-label="origem em revisão"`.
**Testes, antes do código.** `as cinco linhas com o dado típico do mockup: os mesmos números da página do canal em 7 dias` (a mesma fixture da Tarefa 10); `magro`; `zero: "Zero medido: nenhuma view veio da pesquisa"`; `não medido`; `erro só na origem: as quatro linhas antigas continuam e as cinco novas dizem "Não conseguimos ler agora"`; `sem a prova: negado, nenhuma consulta nova e nenhum número`; `quem não edita: a linha de termos é o cadeado e as outras quatro têm número` (ramo da E17); `canal próprio fora do par não é lido` (conta as chamadas); `dois canais próprios no par: dois lidos`.
**Prova por mutação.** Ler todos os canais próprios do site em vez dos do par: o teste de contagem cai.
**Pronto quando:** testes verdes, inclusive os de segurança do cartão que já existem.

### Tarefa 13: "ainda cedo": regra e bloco de impressões

**Contrato** (`LIB/cedo.ts`, puro).
```ts
export const CASAS = 7
export type EstadoCedo =
  | { tipo: 'video-novo'; casas: Casa[]; dia7: DiaYt; faltam: number }
  | { tipo: 'ainda-cedo'; casas: Casa[]; dia7: DiaYt; faltam: number; diasMedidos: number }
  | { tipo: 'grafico'; soZeros: boolean; diasMedidos: number }
  | { tipo: 'nao-medido' }
export interface Casa { dia: DiaYt; estado: 'zero-medido' | 'com-impressoes' | 'dia-nao-chegou' | 'ainda-nao-existe'; valor: number | null }
export function estadoCedo(p: { publicadoEm: DiaYt | null; hojePt: DiaYt; dias: readonly DiaAlcance[] }): EstadoCedo
```
Regra (LEIAME do lote 1, "Regra de conta"): `idade` = dias de calendário da publicação até hoje, no dia do YouTube. `idade < 3` → `video-novo`. `3 <= idade <= 5` e **todos** os dias medidos com 0 impressão → `ainda-cedo`. Algum dia medido com impressão, ou `idade >= 6` → `grafico` (`soZeros` quando todos os medidos são 0). Sem relatório de alcance → `nao-medido`. A faixa tem 7 casas, do dia da publicação (dia 1) ao dia 7 (publicação + 6); `faltam = 6 − idade`; hoje e ontem são sempre `dia-nao-chegou`; casa depois de hoje é `ainda-nao-existe`.
`impressoes-model.ts`: o bloco de impressões do **vídeo** passa a carregar `cedo: EstadoCedo` e as frases do mockup: "Ainda cedo… N dias medidos, todos com 0… em dd/mm (faltam N dias), a última casa da faixa"; "(falta 1 dia, amanhã)"; "Vídeo novo… em dd/mm (faltam N dias)"; com views no cabeçalho e 0 impressão: "o vídeo já teve N views, o relatório de alcance é que chega atrasado"; no dia 7 com tudo 0: "Nenhuma impressão nos N dias medidos, mas o vídeo teve N views. O relatório de alcance do YouTube pode estar incompleto: os 0 são o que ele mandou". `impressoes.tsx` e `.css`: a faixa de 7 casas; com `soZeros` o gráfico mostra só a linha do 0, sem eixo inventado e sem a faixa "cliques estimados".
**Testes, antes do código.** A tabelinha "A: idade, casas e dias que faltam" do LEIAME, **linha por linha** (10 casos: 17 horas, 2 dias, 3 dias zeros, 4 dias zeros, 4 dias números, 5 dias zeros, dia 7 zeros, 8º dia zeros, 8º dia números, coleta não rodou), com a idade montada por data relativa a `hojePt` e afirmando casas até hoje, dias medidos, faltam, dia 7 e a frase. Mais: `publicação nula: nao-medido`; `nenhum dia medido aos 4 dias: nao-medido` (sem relatório não se afirma "todos com 0"); `zero dentro da casa é zero-medido, nunca dia-nao-chegou`; `idade 5 vira grafico no dia seguinte` (fronteira 5 e 6); `idade 2 e 3` (fronteira).
**Armadilhas.** A idade usa o dia do YouTube (`DiaYt`), não horas (pergunta 16). `DIAS_DE_VIDA_MIN` em `dias.ts` não muda (outras telas o usam).
**Pronto quando:** testes verdes; `proprio-impressoes.test.tsx` atualizado no mesmo commit onde o comportamento de 3 a 5 dias mudou.

### Tarefa 14: % assistido por período: regra (puro)

**Contrato** (`LIB/assistido-periodo.ts`).
```ts
export const MIN_VIEWS_PERIODO = 1000
export type PeriodoAssistido = 'inteiro' | '90' | '28'
export interface NormalDoPeriodo { periodo: PeriodoAssistido; de: DiaYt | null; ate: DiaYt | null; pct: number | null; pctArredondado: number | null; views: number; videos: number; motivo: null | 'poucas-views' | 'cobertura-parcial' | 'sem-diario' | 'sem-acesso' | 'leitura-falhou' }   // (emenda 2: D-n2) 'cobertura-parcial'
export function pctDoVideoNoPeriodo(linhas, ytId, de, ate): { pct: number | null; views: number }      // média diária pesada pelas views, como assistidoDoVideo
export function normalDoPeriodo(linhas, ytIds, periodo, ultimoDia, comBuraco: number | null): NormalDoPeriodo   // MEDIANA por vídeo do % assistido no período; (emenda 2: D-n2) comBuraco: vídeos com dia sem cobertura base no período, ou null quando a cobertura não é conhecida
export function normalDaFaixaNoPeriodo(linhas, videos: Array<{ ytId; dur }>, periodo, ultimoDia): Array<{ faixa: FaixaId; normal: NormalDoPeriodo }>
export function contraInteiro(periodo: NormalDoPeriodo, inteiro: NormalDoPeriodo): { dif: number; leitura: 'acima' | 'na-media' | 'abaixo' } | null   // sobre os arredondados; na-media = até 2 pontos
```
Janelas: `'28'` = os 28 dias que terminam em `ultimoDia`; `'90'` = os 90; `'inteiro'` = todos os dias lidos. *(emenda 1: D-I2, D-m10)* `ultimoDia` é o do `lerDiario` tolerante (4.4), recebido por parâmetro: o mesmo dia em que termina a janela de 28 dias da A4 na mesma página. A primeira versão dizia "o último dia gravado", que depois da MG15 pode ser de semanas atrás num canal parado. Entra no período o dia com `views > 0` e percentual medido. Um vídeo entra na mediana se teve view no período. `views` é a soma das views do período entre os vídeos que entraram; abaixo de `MIN_VIEWS_PERIODO`: `pct` nulo e `motivo: 'poucas-views'`. *(emenda 2: D-n2)* **Só se afirma "poucas views" com a cobertura inteira:** abaixo do corte e com `comBuraco > 0` ou `comBuraco === null`, o motivo é `'cobertura-parcial'` (a soma pode estar baixa por falta de coleta, não por falta de view), que a tela mostra como "não medido" com o motivo `cobertura_parcial` da lista fechada. Acima do corte a cobertura não muda nada: o percentual só usa dia com view. `comBuraco` vem de `totalDoPeriodo(d, { de, ate }).comBuraco` (Tarefa 9), nulo quando a cobertura não é conhecida; quem passa é a página (Tarefas 16 e 17). `normalDaFaixaNoPeriodo` recebe o mesmo número e aplica a mesma regra. A mediana vem de `medianaDe` (`assistido.ts`), e a régua de 2 pontos de `NA_MEDIA_PONTOS`.
**Testes, antes do código.** A tabelinha "B: números do exemplo melhorando" do LEIAME, linha por linha, com fixture montada para dar 47, 51 e 52: `51 contra 47 = +4 acima`; `52 contra 47 = +5`; `54 contra 52 = +2 na média`; faixas `55/56 contra 52`, `53/54 contra 47`, `43/44 contra 41 = +2 na média e +3 acima`. Os casos "piorando" (49, 46, 43) e "poucas views" (28 dias com 340 views: `poucas-views`, sem comparar). Mais: `999 views: poucas; 1.000: compara` (a constante é importada, cobertura inteira); *(emenda 2: D-n2)* `340 views e um vídeo com 20 dias sem cobertura no período: cobertura-parcial, nunca poucas-views`; `340 views e cobertura não conhecida: cobertura-parcial`; `340 views e cobertura inteira: poucas-views`; `1.200 views e um vídeo com buraco: compara` (a cobertura só decide abaixo do corte); `a mediana é por vídeo, não a média pesada pelas views do canal` (fixture em que as duas diferem em mais de 5 pontos); `diário vazio: sem-diario`; *(emenda 1: D-I2)* `última linha de 20 dias atrás e ultimoDia de hoje − 3: a janela de 28 dias termina em hoje − 3`; `negado: sem-acesso`; `dia com views e sem percentual não entra`; `diferença calculada sobre os arredondados` (51,4 e 47,6 dão +3, não +4).
**Pronto quando:** testes verdes.

### Tarefa 15: % assistido por período: cartões e aba Retenção do canal

**Contrato.** `assistido-periodo-model.ts` (puro): monta os três cartões ("Canal inteiro", "Últimos 90 dias", "Últimos 28 dias"; curtos "Inteiro", "90 dias", "28 dias"), cada um com o normal, o ▲ ▼ ＝ contra o canal inteiro e, na página do vídeo, a frase "Acima do normal dos últimos 90 dias: 54% contra 51% (+3 pontos)"; na aba do canal, "Nos últimos 90 dias, o vídeo típico foi assistido por 51%; no canal inteiro, 47% (+4 pontos)" e a tabela por faixa de duração com a conta fechando por célula; título "Vídeos mais assistidos, contra o normal da faixa (últimos 90 dias)". `assistido-periodos.tsx` (`'use client'`): `radiogroup` de três cartões (um só no Tab, setas), `localStorage` (`obs-proprio-assistido-periodo`), padrão "canal inteiro", `?assistido=` vence *(emenda 1: S-m2; era `?periodo=`)*, "Salvo neste navegador · Voltar ao padrão" só fora do padrão; mostra um conteúdo por vez. Cartão com `poucas-views`: hachura do "não medido" e "poucas views", sem número e sem seta. *(emenda 2: D-n2)* Cartão com `cobertura-parcial`: a mesma hachura e "não medido: {N} de {M} vídeos sem o período inteiro medido" (com a cobertura não conhecida, "não medido: não sabemos se o período inteiro foi coletado"), sem número e sem seta; dois textos novos, para o revisor de UX. `retencao-model.ts` e `retencao.tsx` (aba do canal): passam a receber os três períodos *(emenda 1: D-I6, S-I8: como conteúdo já renderizado, vindo do `Suspense` de `AssistidoDoCanal`, Tarefa 17)*.
**Testes, antes do código.** `os três cartões com 47, 51 e 52 e as setas do mockup`; `poucas views: hachura, sem número, sem seta`; *(emenda 2: D-n2)* `cobertura-parcial: hachura, a frase com N de M, e o cartão não contém "poucas views"`; `canal inteiro escolhido: sem a linha de lembrança`; `90 dias salvo: a linha aparece`; `seta troca o cartão e o conteúdo`; `?assistido=28 vence`; *(emenda 1: S-m2)* `?origem=90 na URL não muda o cartão`; *(emenda 1: S-m8)* `diário que começa depois da publicação: o primeiro cartão se chama "Desde dd/mm/aaaa"`; `localStorage que lança não quebra`; `negado: os três cartões com a frase de acesso de hoje e nenhum número` (segurança: HTML, `title`, `aria`); `a frase do canal usa "vídeo típico"`; `assistido-periodo.css sem color-mix(`. Item 241 (C-13): o componente entra na lista de permitidos.
**Pronto quando:** testes verdes; os dois testes da aba que já existem atualizados no mesmo commit.

### Tarefa 16: integração na página do vídeo (quatro commits em série)

**Antes de cada commit:** `git status` limpo em todos os arquivos da lista; se houver alteração de outro terminal, esperar.
**Contrato.**
- `dados.ts`: *(emenda 1: D-I6, S-I8)* ganha a função `lerDiarioLongo(a)`, que devolve `Privado<{ d90: DiarioDoPeriodo; inteiro: DiarioDoPeriodo }>` (falha vira `{ acesso: 'erro' }`, com um aviso). **`lerDadosDoVideo` não a chama**: a primeira versão punha o diário longo dentro de `lerDadosDoVideo`, antes do primeiro HTML, e até 10 idas ao banco em série segurariam toda abertura de vídeo próprio. Quem a chama é um componente de servidor assíncrono, `AssistidoDoVideo`, dentro de `<Suspense>` próprio, com os cartões de período em esqueleto como `fallback`. *(emenda 2: D-n2)* `AssistidoDoVideo` passa a `normalDoPeriodo` o `comBuraco` de cada período (`totalDoPeriodo(d, { de, ate }).comBuraco`, ou nulo com a cobertura não conhecida). `dados.ts` também não chama a origem (ela tem entrada própria e vai por `Suspense`).
- `video/[id]/page.tsx`: monta a seção da curva (`buildCurvaJanelas`, `CurvaSecao`); e um componente de servidor assíncrono `OrigemDoVideo` dentro de `<Suspense fallback={<OrigemEsqueleto />}>`, que chama `lerOrigem` e `lerTermosESites`, monta `buildOrigem` e devolve `<Origem />`. O nível vem de: sem prova → `so-aviso`; com prova, `lerTermosESites` negado **e a página sabe que a pessoa não edita** → `sem-termos`; senão `tudo`. *(emenda 1: S-m6, D-m4)* Se `lerTermosESites` devolve `erro`, ou devolve `negado` para quem a página sabe que edita (a segunda chamada à guarda falhou), o nível é `tudo` e o bloco de termos lê erro, com um aviso ao Sentry: quem edita nunca lê "só para quem edita". *(emenda 2: S-n2; a primeira versão mandava conferir um `canEdit` na página do vídeo e parar se não existisse: ele **não existe** lá, o `grep` não devolve nada, a página chama `podeVerPrivado(siteId)` direto na linha 46 e `canEdit` só existe em `_chrome/page-data.ts:58,90`, da página do canal)* O "sabe que edita" é `podeEditar`, derivado assim: **com a E17 fora do HEAD**, `podeEditar = edicao !== null` (o token de leitura é o de edição; é a mesma conta de `page-data.ts:90`); **com a Tarefa 6 da E17 no HEAD**, a página troca `podeVerPrivado(siteId)` por `acessoPrivado(siteId)` e `podeEditar = acesso.edita` (linhas 313 e 522 do plano da E17). Nenhuma segunda guarda de edição na página. *(emenda 2: S-n5)* **O aviso é do contrato de `OrigemDoVideo`:** quando algum bloco de `buildOrigem` volta com `videosFora > 0`, `videosParados > 0` ou `cobertura_parcial`, o componente chama o Sentry **uma** vez por requisição (`component: 'observatorio-proprio'`, `step: 'origem-cobertura'`), só com as contagens.
- `video-blocos-model.ts` e `video-blocos.tsx`: `BlocoRetencao` vira a vista da Tarefa 5; `BlocoImpressoes` leva o `cedo`; `BlocoAssistido` leva os três períodos *(emenda 1: D-I6, S-I8: como conteúdo já renderizado, vindo do `Suspense` de `AssistidoDoVideo`; o bloco não espera a leitura)*; a constante `AINDA` perde "Origem do tráfego (esta tela ainda não a mostra) e"; a ordem das seções: Views, Impressões, % assistido, Retenção, **De onde vêm as views**, o resto. *(emenda 2: S-n7)* Estas duas mudanças (a frase da `AINDA` e a seção "De onde vêm as views" na ordem) são do **commit (d)**: nos commits (a), (b) e (c) a página continua dizendo que não mostra a origem, porque ainda não mostra.
**Commits, nesta ordem:** (a) tela A; (b) tela B; (c) 11b; (d) 12. Cada um com os seus testes. *(emenda 1: S-I7)* Os quatro mexem nos **mesmos** arquivos, e cada um é escrito em cima do anterior: num envio por lista explícita de commits, o (d) não aplica sem o (c). Por isso a ordem de envio A, B, R, O é **obrigatória**, não recomendada (seção 11). A única troca permitida é entre (c) e (d), e ela é decidida pelo controlador **antes** de a tarefa começar, conforme o que chegar primeiro a `main` (MG5 e E8, ou MG7 e E11); depois de escritos, os commits não se invertem.
**Testes, antes do código.**
- `proprio-dados.test.ts`: `sem prova, nenhum leitor novo é chamado e o cliente de serviço não é criado`; `falha no diário longo não derruba alcance, diário nem retenção`; *(emenda 1: D-I6, S-I8)* `lerDadosDoVideo não chama lerDiarioDoPeriodo` (conta as chamadas).
- `proprio-video-rota.test.ts`: `a página do vídeo próprio tem as seis seções na ordem`; `o grupo da origem está dentro de um Suspense com o esqueleto`; *(emenda 1: D-I6, S-I8)* `os cartões de período estão dentro de outro Suspense`; *(emenda 1: S-m6)* `quem edita e a leitura dos termos falha: bloco de erro nos termos, e o HTML não contém "só aparecem para quem edita"`; *(emenda 2: S-n2)* `podeEditar sai do token de edição quando a E17 não está no HEAD` e, com ela, `podeEditar sai de acessoPrivado(siteId).edita, e quem tem só o direito recebe podeEditar falso` (um teste para cada ordem; o segundo é escrito quando a C-14 disser que a E17 chegou); *(emenda 2: S-n5)* `dois blocos com videosFora e um com cobertura_parcial: um aviso só na requisição, com as contagens e sem id de vídeo`; `nenhum bloco com vídeo fora, parado ou cobertura parcial: nenhum aviso`; *(emenda 2: S-n7)* `no commit (c) a constante AINDA ainda cita a origem` (o teste muda no commit (d), junto do código); `vídeo de concorrente não lê nada disto` (conta as chamadas).
- **`proprio-video-seguranca.test.tsx` (o portão):** com a semente de teste cheia de sentinelas (views 73519, termo "sentinela-termo-xyz", endereço "sentinela.example", curva com ponto 0,7319), para quem **não tem a prova**: o HTML renderizado, as propriedades serializadas de **todo** componente cliente (`CurvaJanelas`, `OrigemPeriodos`, `AssistidoPeriodos`) e os atributos `title`, `aria-label`, `aria-describedby`, `data-*` e `alt` não contêm nenhum sentinela; nenhum leitor foi chamado. Para quem **tem a prova e não edita** (ramo da E17): contém os de views e de curva, não contém o termo nem o endereço. Cada afirmação tem o seu controle negativo (com a prova de edição, o sentinela **aparece**: o teste não passa por estar olhando o lugar errado).
- `proprio-video-tela.test.tsx:308` e as expressões irmãs: ganham os nomes dos módulos novos (`dados-origem`, `dados-termos`, `ler-diario-periodo`) como importações proibidas em componente cliente, cada uma com controle negativo.
**Armadilhas.** Next 16: `OrigemDoVideo` é filho de servidor passado como `children`; nenhum componente é passado como propriedade. `maxDuration` não muda.
**Pronto quando:** os quatro commits verdes, um por vez; `npx tsc --noEmit -p apps/web` limpo; a pasta `test/youtube/observatorio/` inteira verde (saída em arquivo, só as falhas no contexto).

### Tarefa 17: integração na página do canal

**Contrato.** *(emenda 1: S-I1, S-I2, S-I7, D-m5; este parágrafo substitui o da primeira versão, que lia a origem "só com `?aba=origem`", usava `ownYtIds` e tirava o total de "Desde {ano}" do contador público do canal.)*
- **Dois commits nomeados.** **(17a) aba Retenção com os três períodos** (lote E5b-B): `canal/[id]/page.tsx`, `proprio-screen.tsx`, `T/proprio-rota.test.ts`. **(17b) aba Origem** (lote E5b-O): todos os arquivos da lista.
- **O parâmetro é `tab`, não `aba`**, e as abas trocam **no navegador**: `_proprio/proprio-screen.tsx:3-6` ("Tudo troca no navegador (o servidor já mandou o pacote inteiro)") e a linha 76 (`e.preventDefault(); onAba(a.tab)`). Entram na tarefa: `links.ts` (`CanalTab` ganha `'origem'`), `_canal/params.ts` (`TABS_PROPRIO` ganha `'origem'`; sem isso `?tab=origem` cai no padrão) e `view-model.ts` (aba "Origem", a quinta, pergunta 9).
- **Como a aba carrega.** A página lê a origem em **toda** abertura do canal próprio, num componente de servidor assíncrono `OrigemDoCanal`, dentro de `<Suspense fallback={<OrigemEsqueleto />}>`, e entrega esse nó a `proprio-screen.tsx` como conteúdo já renderizado (uma propriedade `origem: ReactNode`, o mesmo encaixe da seção "Como o canal está"); o cliente só decide se o mostra. O primeiro HTML não espera a leitura; quem clica em "Origem" vê o esqueleto até o pedaço chegar e depois o grupo. Os cartões de período da aba "Retenção" (17a) vêm pelo mesmo caminho, num segundo `Suspense` (`AssistidoDoCanal`). Custo declarado: toda abertura do canal próprio paga as consultas da origem no servidor (5.3), fora do caminho que segura a página. **Não testei** que um nó com `Suspense` passado como propriedade e ainda não mostrado resolve quando a aba abre, nem se `useSearchParams` nos componentes cliente pede um `Suspense` a mais no Next 16: *(emenda 2: S-n1)* quem prova é o passo de navegador da Tarefa 18 ("abrir na aba Vídeos, clicar em Origem, sem recarregar"), não o teste de jsdom desta tarefa: em jsdom não há entrega em pedaços do servidor, o nó chega pronto e o teste passa nos dois desenhos. Se ele não passar, ou se a medida de tempo da Tarefa 18 estourar a meta, a saída é uma só e fica escrita: o clique em "Origem" vira navegação de verdade (sem `preventDefault` para essa aba) e a leitura passa a ser feita só com `?tab=origem`; a troca vai ao ledger.
- **Quais vídeos** (pergunta 20): `videosDaOrigem(obs, proprio.id)`, todos os vídeos do canal que o Observatório traz, de qualquer formato, acompanhados ou não, em lotes de 50. **Não** `ownYtIds`, que são só os longos acompanhados (`_chrome/page-data.ts:90`): com ele a aba diria "seus vídeos" e "31% no feed de Shorts" somando só os longos. A aba "Retenção" continua com `ownYtIds` (é a regra da A4 para o % assistido).
- **Períodos e totais.** 7, 28, 90 dias e "Desde {ano}", em que `ano` é o da publicação mais antiga do canal. `totalDoPeriodo` vem **sempre do diário**, dos mesmos vídeos da divisão e pela função `totalDoPeriodo` da Tarefa 9 (nulo quando a cobertura não fecha): o de 7, 28 e 90 dias de uma leitura de 90 dias; o de "Desde {ano}" da leitura do diário inteiro com `soComViews`, dentro do mesmo `Suspense`. *(emenda 2: S-n6)* Os dois diários chegam por `lerOrigem` (`OrigemLida.diario` e `OrigemLida.diarioInteiro`, Tarefa 9); a página não chama leitor nenhum. *(emenda 2: D-N1)* Cada total é `totalDoPeriodo(diario, { de, ate })` **do seu período**, com a contagem (`videosDoTotal`) entregue junto a `buildOrigem`; um buraco antigo não apaga o total de 7 dias, e um vídeo que saiu do YouTube deixa de ser exigido pela regra de 4.3. *(emenda 2: S-n5)* **O aviso é do contrato de `OrigemDoCanal`**, igual ao de `OrigemDoVideo` (Tarefa 16): um por requisição, só com as contagens. *(emenda 2: D-n2)* `AssistidoDoCanal` passa a `normalDoPeriodo` o `comBuraco` de cada período. Quando o diário não cobre desde a publicação mais antiga (C-10), ou a leitura passa do teto, o total de "Desde {ano}" é nulo e a célula lê "não medido" com o motivo; nunca o contador público do canal ao lado de uma divisão feita sobre outro conjunto de vídeos. No topo da aba, a faixa de duas células do mockup: "views no período" e "dias com origem medida" ("{N}" e "de {M}"; "0 de {M} · a coleta começa em dd/mm"; o símbolo de sem número com "não conseguimos ler agora"; "· origem em revisão"). A aba "Retenção" recebe os três períodos da Tarefa 15. `como-esta-model.ts`: `NAO_MEDIDO` perde a linha "Origem do tráfego"; a linha da curva segue o desvio 5.
**Testes, antes do código.** *(emenda 1: S-I1)* **`vindo da aba Vídeos, clicar em Origem mostra o nó recebido em origem`** (falha hoje, porque a aba não existe; *(emenda 2: S-n1)* é teste de componente: prova que o cliente mostra o nó, **não** decide o encaixe com `Suspense`, que é decidido em navegador na Tarefa 18); `?tab=origem abre na aba Origem` e `?tab=origem num canal de concorrente cai no padrão` (em `canal-params.test.ts`); `a aba origem existe e é a quinta`; `canal próprio sem prova: lerOrigem não é chamado e o cliente de serviço não é criado` (conta); `com ?tab=origem e sem prova: o aviso, nenhum número, nenhum leitor`; *(emenda 1: S-I2)* `canal com um Short com views: as views dele entram no total e na divisão da origem`; `a aba Retenção continua lendo só os longos acompanhados`; *(emenda 1: D-m5)* `diário que não cobre desde a publicação mais antiga: a célula de "Desde {ano}" lê não medido e o HTML não tem o contador público do canal`; `"Desde {ano}" usa o ano do vídeo mais antigo`; `canal sem vídeo com data: o período longo não é oferecido`; `cobertura incompleta em 90 dias: a célula lê não medido com "N de M vídeos"` *(emenda 1: D-I2)*; *(emenda 2: D-N1)* `buraco só entre 40 e 20 dias atrás: a célula de 7 dias mostra o número e a de 90 lê não medido`; `um vídeo sem cobertura há 30 dias: as células de 28 e de 90 dias mostram o número com "de 34 dos 35 vídeos"`; *(emenda 2: S-n5)* `um aviso por requisição quando há vídeo fora ou parado, e nenhum quando não há`; *(emenda 2: S-n6)* `a página não importa ler-diario-periodo` (lê o código do arquivo); `diarioInteiro nulo: a célula de "Desde {ano}" lê não medido e as outras três continuam`; `"O que ainda não é medido" não cita origem`; `proprio-canal-seguranca.test.tsx`: os mesmos sentinelas e os mesmos três níveis da Tarefa 16, na aba.
**Pronto quando:** testes verdes; `tsc` limpo.

### Tarefa 18: semente, capturas, revisão de UX e validação autenticada

**Semente** (`e2e/fixtures/observatorio-seed.ts`, depois de `git status` limpo). Perfis novos, sem tocar os existentes: `curva-janelas` (um vídeo com as três janelas lidas e três leituras de vida; um com 7 e 30 dias anteriores à coleta e uma leitura; um com resposta vazia; um com 41 views; um com erro e leitura anterior; um publicado ontem), `origem` (os estados típico, magro, zero, não medido e revisão, com os números da seção 11 da NOTAS do 12, mais um termo e um endereço sentinela), `cedo` (4 dias com zeros; 4 dias com números), `assistido-periodo` (os casos melhorando e poucas views). `clearOwnL2` passa a apagar as três tabelas de dimensões antes dos canais, depois de conferir se a Tarefa 13 da E8 já apaga a de retenção.
**Capturas** (subagente Sonnet, navegador; saída em `…/2026-10-13-a5-lote-2/e5b-shots/`, fora do commit de código): cada tela, nos estados **vazio** (banco sem as tabelas preenchidas), **parcial** (uma semana) e **cheio**, a 1440 px tema escuro e 390 px tema claro (o par obrigatório), mais 1440 claro e 390 escuro nos estados típicos; sem rolagem horizontal e sem erro de console (item 36).
**Portão de UX, por tela** (item 106). O agente `revisor-ux-senior` compara cada tela implementada com o mockup aprovado **em navegador** e registra em `.superpowers/sdd/a5-e5b/REVISAO-UX-IMPLEMENTADO.md`: 0 diferença de estrutura; contraste de texto e de elemento gráfico nos dois temas, com o número; alvos de 44 px a 390 px; os textos novos deste plano (perguntas 4, 14 e 15, os de "como mudou" sem cruzamento e, *(emenda 2)*, os sete do desvio 15); a lista do que **não** conseguiu verificar. Divergência não declarada na seção 8 é "corrige". Quatro vereditos, um por tela: nenhuma tela vai a envio com "corrige" aberto.
**Conferência de segurança em navegador** (o que os testes de unidade não veem): logado como usuário sem a prova, salvar o HTML e a resposta RSC das duas páginas e procurar os sentinelas: `grep -c` = 0 nos dois. Com o usuário de leitura com direito (se a E17 estiver no HEAD): sem o termo e sem o endereço.
**Validação autenticada do CMS** (`docs/ops/runbook-cms-e2e-local.md`) antes da promoção.
**O teste que decide o encaixe da aba Origem** *(emenda 2: S-n1)*, em `e2e/tests/cms/observatorio/proprio-e5b.spec.ts`: abrir o canal próprio **na aba Vídeos** (sem `?tab=`), clicar em "Origem", esperar o grupo lido aparecer (a barra da origem com o número da semente), **sem recarregar a página** e sem a URL passar por uma navegação completa; e o mesmo com a rede atrasada o bastante para o esqueleto ser visto antes. Se o grupo não aparecer, vale a saída escrita na Tarefa 17 (navegação de verdade). As capturas, que abrem a aba pela URL, não provam isso.
**Tempo:** *(emenda 1: D-I6, S-I8)* medir a abertura da página do vídeo, da página do canal e da aba Origem com uma semente de diário **do tamanho que a C-10 devolver** (não "a semente cheia" de exemplo), e medir à parte o tempo de **uma** ida de 1.000 linhas, que hoje é estimativa (50 ms). Anotar: o tempo até o primeiro HTML (que não pode crescer, porque as leituras novas estão em `Suspense`) e o acréscimo até o último pedaço, contra a meta de 1,5 s. Se uma ida passar de 150 ms, o corte de 10.000 linhas da C-10 é refeito para `1,5 s ÷ tempo da ida × 1.000`. *(emenda 2: S-n6)* A medida da página do canal conta as **duas** leituras paginadas do diário inteiro (a da aba Retenção e a da origem, cada uma de até 10 idas); a meta de 1,5 s vale para cada `Suspense`, e os dois tempos são anotados separados.
**Pronto quando:** as capturas existem; *(emenda 2: S-n1)* o passo "clicar em Origem sem recarregar" passou (ou a troca para navegação de verdade está no ledger); os quatro vereditos de UX são "pronto"; os dois `grep` de segurança deram 0; os dois especialistas revisaram a implementação.

### Tarefa 19: envio e conferências

**Contrato** (`lib/conferencias.ts`, no molde de `conferenciasE1E2`): *(emenda 1: S-m3)* **uma data por lote**, `export const E5B_DEPLOY: { a: string | null; b: string | null; r: string | null; o: string | null }`, todas nulas, e `conferenciasE5B(deploy)`, com `etapa: 'E5'` e ids `e5b-…`; `CONFERENCIAS` passa a espalhar também essa lista. Com uma constante só, os lotes A e B ficariam em produção sem conferência com data até o último lote sair. Cada data é preenchida no commit do envio **daquele** lote. Entradas (datas relativas ao dia de São Paulo da promoção a `main` do lote indicado): `e5b-d0` existe uma vez por lote (`e5b-d0-a`, `-b`, `-r`, `-o`); `e5b-d1` e `e5b-d28` contam do lote R; `e5b-d7` e `e5b-trechos` do lote O.

| id | Quando | Quem | O que e o esperado |
|---|---|---|---|
| `e5b-d0` | D0 | dono | abrir um vídeo próprio e a aba Origem do canal em produção: as telas abrem; a retenção e a origem mostram o estado da seção 7 para aquele dia (não medido com data, ou as primeiras leituras); nenhum erro |
| `e5b-d1` | D+1 | agente | consulta K1 do Apêndice A: para dois vídeos com curva, refazer à mão "metade saiu aos m:ss" e o número da faixa a partir de `points`; conferem com a tela (item 64, com a Tarefa 13 da E8) |
| `e5b-d7` | D+7 | agente | K2 *(emenda 1: D-I5: consulta refeita, parte das origens)*: `dias_em_revisao` e `dias_sem_cobertura_base` (esperado 0 nos dois); K3: soma das origens menor ou igual ao diário em todo dia coberto (item 90), pela mesma consulta; K4: valores de `dim_value` fora da tabela de grupos (esperado 0; se houver, emenda da Tarefa 7) |
| `e5b-d28` | D+28 | agente | K5 (ruído contra views) e K6 (mediana contra média): rever o limiar de 500 e o agregador; anotar a decisão. Sem 5 curvas de volumes diferentes: remarcar para D+56 |
| `e5b-trechos` | 20/12/2026 | agente | a leitura da origem passa a dois trechos em janeiro de 2027: medir o tempo da aba Origem com "Desde {ano}" e decidir se a agregação vai para o banco |

**Testes** (`test/lib/conferencias.test.ts`): *(emenda 1: S-m3)* `as quatro datas nulas: nenhuma entrada`; `só a do lote A preenchida: uma entrada, e5b-d0-a`; `uma data malformada: uma entrada de 1970 que manda corrigir`; `as quatro preenchidas: as oito entradas com as datas certas, cada uma contada do seu lote`; `cada data publicada é nula ou uma data real`.
**Ordem do envio:** seção 11.
**Pronto quando:** CI verde em cada push; deploy pronto; a `e5b-d0` de cada lote anotada.

---

## 11. Envio: ordem que não pode inverter, volta e conferências

Envio por **lista explícita de commits** (há outros lotes locais não enviados). Promoção fora de 11:55 a 12:15 UTC e fora dos minutos 0, 20 e 40. CI conferido a cada push. Não há migration nem variável nesta etapa; a ordem que importa é a das dependências.

| Lote | Vai | Tem de estar em `main` (ou em produção) antes | Se inverter |
|---|---|---|---|
| **E5b-A** | Tarefa 13 e o commit (a) da 16; *(emenda 1: S-I7)* **a Tarefa 1** (as Tarefas 13, 15, 8 e 10 tipam `motivo` com `MotivoNaoMedido`: sem ela nenhum lote compila) e o código da Tarefa 19 | A4 em `main` | o lote não aplica (os arquivos da A4 não existem em `origin`) |
| **E5b-B** | Tarefas 14, 15, *(emenda 2: D-N1)* o commit (8a) da 8 (`na-conta.ts`, de que o 9a depende), o commit (9a) da 9, o commit (b) da 16 e o commit (17a) da 17 | lote E5b-A; A4 em `main`; C-10 respondida; *(emenda 1: D-I2)* **MG14 aplicada e o lote E6-P2 (leitor tolerante, Tarefa 5 da E6) em `main`**: o leitor novo lê a cobertura `base` e recebe o `ultimoDia` tolerante | sem a C-10, a leitura do diário inteiro pode passar do teto: o cartão "Canal inteiro" lê erro (vermelho, não verde). *(emenda 1: D-I2)* Antes da MG14: a cobertura é "não conhecida", nenhum total de período aparece e há um aviso ao Sentry por abertura. Antes do E6-P2 em `main`: o `ultimoDia` recebido ainda é o do leitor antigo (a última linha) e, depois da MG15, as janelas de 28 e 90 dias terminariam em dia velho; por isso a ordem |
| **E5b-R** | Tarefas 2, 4, 5, 6 e commit (c) da 16; a 3 só com a resposta explícita do dono *(emenda 1: S-I7, D-I7: a Tarefa 1 passou para o lote A)* | lotes E5b-A e E5b-B; A4 em `main`; **MG14 e MG5 aplicadas e conferidas**; lote E8-coleta em `main`; Tarefa 13 da E8 (no mesmo envio ou antes) | código antes da MG5: a seção lê "Ainda não coletamos" e manda um aviso ao Sentry a cada abertura de página (ruído, não mentira). Código antes do E8-coleta em `main`: não compila (o tipo `Janela` mora lá) |
| **E5b-O** | Tarefas 7, 8 *(emenda 2: D-N1: o commit 8b; o 8a foi no lote B)*, o commit (9b) da 9, 10, 11, 12, commit (d) da 16 e o commit (17b) da 17 | lotes E5b-A, E5b-B e E5b-R *(emenda 1: S-I7)*; A4 em `main`; **MG14 e MG7 aplicadas e conferidas**; lote da E11 em `main` (com `DIMENSOES_DESDE` e `DIMENSOES_LIGADO_EM` confirmadas) | código antes da MG7: todo bloco lê "não medido" e, passada a data prevista, "A coleta ainda não começou." com aviso ao Sentry. Código antes da E11 em `main`: não compila |
| **Conferências** | Tarefa 19 | *(emenda 1: S-m3)* o código da Tarefa 19 vai no **primeiro** lote enviado, com as quatro datas nulas; cada lote preenche a sua no commit do seu envio | data de um lote preenchida antes do envio de verdade faz as conferências dele vencerem cedo e, em 8 dias, deixa o cron do canal próprio vermelho |

*(emenda 1: S-I7)* Os quatro lotes de tela **não** são independentes (a primeira versão dizia que eram): podem ir em dias diferentes, mas a ordem A, B, R, O é **obrigatória**, por três motivos que estão no próprio plano: a Tarefa 1 é base de tipo dos outros três lotes; os quatro commits da Tarefa 16 mexem nos mesmos arquivos, um em cima do outro; e a Tarefa 17 tem um commit em cada um de dois lotes. **Se a MG7 e a E11 chegarem a `main` antes da MG5 e da E8:** o lote O **espera** o lote R. A única alternativa é o controlador ter decidido, antes de a Tarefa 16 começar, escrever o commit (d) antes do (c); com os commits já escritos na ordem (c), (d), não se faz `cherry-pick` do (d) sozinho (ele conflita, ou arrasta o (c) e publica a seção de retenção antes da MG5). *(emenda 1: S-m10)* A mesma ordem é o que evita a janela de avisos repetidos ao Sentry (código antes da migration): nenhum lote sobe antes da migration dele; não se usa amostragem, que esconderia a falha. A Tarefa 18 (capturas, UX, validação autenticada) é feita **por lote**, antes do push daquele lote.

**Volta.** Reverter os commits do lote. Não há dado gravado, migration nem variável a desfazer; as três chaves de `localStorage` ficam no navegador e são ignoradas pelo código antigo. A Tarefa 3 (regra da coleta), se tiver rodado, volta sozinha com o seu commit; o que ela deixou de buscar enquanto valeu volta a ser buscado, dentro dos 45 dias.

**Conferências com data:** as da Tarefa 19, com os valores esperados lá: *(emenda 1: S-m3)* oito entradas, isto é, a D0 de cada um dos quatro lotes, mais D+1 e D+28 (contadas do lote R), D+7 e 20/12/2026 (do lote O); e a C-16, "ao primeiro vídeo novo" *(emenda 1: D-I7)*.

---

## 12. Onde está cada item de aceite

| Item | Onde |
|---|---|
| 34 e 101 (tela só com mockup aprovado; cada tarefa cita a aprovação) | 11b e 12: `docs/superpowers/mockups/2026-10-13-a5-lote-2/APROVACOES-DO-DONO.md` (linhas do 11b e do 12, 13/10); A e B: decisão 62 em `.superpowers/sdd/a5/decisoes-do-dono.md`. Tarefas 5, 6, 10, 11, 12, 13, 15 |
| 35 (cada número novo com base, janela e ⓘ) | ⓘ das Tarefas 5 e 10 (copiados das NOTAS); a frase "cálculo do Observatório" nos ⓘ da origem; a faixa diz "cálculo do YouTube" porque o número é dele (desvio declarado: é o que o mockup aprovado diz) |
| 36 (vazio, parcial e cheio; 1440 e 390; dois temas; sem rolagem; sem erro de console) | Tarefa 18 |
| 37 ("não medido" com forma única e motivo da lista fechada; nenhum zero onde a contagem é ausente) | Tarefa 1 (lista, pergunta 11); Tarefas 5, 8 e 10 (o campo `motivo` é tipado); testes "apaga e afirma" das Tarefas 8 e 13 |
| 41 e a parte de tela do 89 (só leitura não vê dado privado no HTML nem no RSC; termos e sites) | Tarefas 9 (entrada dos termos e varredura), 11, 12, 16 e 17 (testes de segurança com sentinela) e 18 (o `grep` em navegador) |
| 64 (retenção vista em navegador com dado real; "metade saiu aos m:ss" refeita à mão; data da leitura na tela) | é da Tarefa 13 da E8 (`e8-tela-dado-real`); este plano acrescenta a faixa na mesma conferência (`e5b-d1`) e mostra "Leitura de dd/mm" em todo cartão lido |
| 90, segunda metade (a diferença aparece como "omitido pelo YouTube") | Tarefas 8 e 10; `e5b-d7` (K3) |
| 93 (seções novas vistas em navegador, com mockup aprovado antes, vazio, parcial e cheio) | Tarefa 18. A parte "`youtube_channel_removal_impact` conta as três tabelas" é da MG7 (plano da E11) |
| 103, 104 (revisão de UX dos mockups antes do dono) | já cumpridos: `REVISAO-UX-r1` e `r2` do 11b; `r1` a `r6` do 12; `REVISAO-UX.md` e `AJUSTES-UX-2.md` do lote 1 |
| 105 | não é desta etapa (mockups de 12/10) |
| 106 (cada tela implementada conferida pelo revisor de UX contra o mockup, em navegador, antes de produção) | Tarefa 18, um veredito por tela |
| 227, parte de tela (três estados; "omitido"; "em revisão") | Tarefas 8, 10 e 11 |
| 228, parte de tela ("não medido: a coleta começou em dd/mm", nunca zero) | Tarefas 8 e 10 |
| 241 (cores de direção só para direção) | pergunta 12; Tarefas 6 e 15 (C-13) |
| 83 a 88, 91, 92, 226, 249 | **fora**: são da coleta e do banco da E11 (plano dela, seção 12) |
| **E5B-1** (novo, 11b): os 13 estados do mockup existem em teste, com a frase exata de cada um | Tarefa 5 |
| **E5B-2** (novo, 11b): a zona da faixa é decidida sobre o valor com duas casas que aparece | Tarefa 2 |
| **E5B-3** (novo, 11b): janela que a coleta nunca vai buscar não lê "ainda não coletada" | Tarefa 5 (fronteiras `antes` e `desistida`) |
| **E5B-4** (novo, 11b): a escolha de janela sobrevive a `localStorage` indisponível e a URL vence | Tarefa 6 |
| **E5B-5** (novo, 12): em todo estado medido, total = soma das linhas + omitido, e as porcentagens somam 100 | Tarefa 8 (200 casos) |
| **E5B-6** (novo, 12): três níveis de acesso, cada um com teste de HTML, propriedades e atributos | Tarefas 11, 16, 17 |
| **E5B-7** (novo, 12): termos e sites só com a prova de edição, antes e depois da E17 | Tarefa 9 |
| **E5B-8** (novo, 12): período longo lido em trechos dá o mesmo resultado que em um | Tarefa 9 (integração) |
| **E5B-9** (novo, A): a tabelinha de idade, casas e dias que faltam do LEIAME, linha por linha | Tarefa 13 |
| **E5B-10** (novo, A): hoje e ontem nunca são zero | Tarefa 13 |
| **E5B-11** (novo, B): a tabelinha de números do LEIAME, linha por linha, com as diferenças sobre os arredondados | Tarefa 14 |
| **E5B-12** (novo, B): abaixo de 1.000 views no período não há número nem seta | Tarefas 14 e 15 |

Nenhum item do spec que toca estas telas ficou sem tarefa. Os itens E5B-1 a E5B-12 são propostos; o controlador dá os números definitivos no spec.

---

## 13. Riscos que ficam, sem suavizar

1. **Por semanas a tela é quase toda "não medido" e "omitido".** O canal tem 36 views em 90 dias. O 12 vai mostrar o estado "magro" e o 11b, uma leitura por vídeo, ou nenhuma. É o estado real e os mockups o desenharam, mas o dono vai abrir a tela e ver pouco.
2. **O limiar de 500 views e a escolha da mediana saem de três vídeos.** Estão marcados como provisórios, com revisão em D+28, e podem mudar o que a tela diz de uma curva.
3. **O "Canal inteiro" da tela B depende de uma leitura cujo tamanho não foi medido** (C-10). Se passar do teto, a tela B vai sem ele até existir uma agregação no banco. *(emenda 1: D-I6, S-I8)* O teto agora é de 10.000 linhas, e o tempo de uma ida ao banco, de que ele depende, é estimativa até a Tarefa 18.
4. **Um dia "em revisão" põe o bloco inteiro em revisão pelo período todo.** É a regra simples e a do mockup; se acontecer com frequência (C-5, `e5b-d7`), a tela trava e a regra precisa excluir só o dia.
5. **A leitura da origem cresce com o tempo.** Dois trechos a partir de janeiro de 2027, quatro por ano. O teto de 12 chamadas (trechos vezes lotes de vídeos; emenda 1: S-m7) e o de 100.000 linhas fazem a falha aparecer em vermelho, mas a correção de verdade (agregar no banco) é migration de outra etapa.
6. **Quatro planos mexem em `video-blocos*` e três em `dados.ts`.** A Tarefa 16 é serial e confere `git status`, mas a ordem entre ela, a Tarefa 13 da E8, a E18 e a Tarefa 6 da E17 é do controlador.
7. *(emenda 1: S-I9)* **A barreira dos termos é de convenção, guardada por varredura.** Depois da E17, `lerDetalheDaOrigem` aceita o token de leitura; o que impede termos e sites de chegarem a quem só tem o direito é `dados-termos.ts` pedir a prova de edição e a varredura proibir a chamada do leitor em qualquer outro arquivo. Um arquivo novo que consulte a tabela de detalhe direto, sem o leitor, só a revisão pega (a varredura cobre `src/app/api/`). A alternativa, uma segunda prova dentro do leitor, bate de frente com a varredura da Tarefa 6 da E17 e fica para decisão do controlador entre os dois planos.
8. **A troca visível depois da hidratação** para quem tem escolha salva diferente do padrão (4.1). Aceita em troca de não ir ao servidor a cada troca; o revisor de UX olha na Tarefa 18.
9. **A data da marca de contagem** fica 24/08/2026 pelo padrão, e o código do dado mostrado diz 27/08 (pergunta 10).
10. *(emenda 1: D-I1, S-I3)* **Tirar da conta o vídeo sem nenhum dia medido muda o que "seus vídeos" quer dizer naquele período.** A tela diz quantos saíram, e o total fecha com os que ficaram, mas num período curto (7 dias) um vídeo só atrasado e um vídeo que nunca terá leitura são iguais para a regra. A alternativa (a aba inteira em branco por causa de um vídeo) é pior; a escolha passa pelo revisor de UX e pelo dono na `e5b-d0`. *(emenda 2: D-N1)* **O que acontece nos períodos longos, dito por inteiro.** Um vídeo que sai do YouTube (F17: ele continua na lista) passa por três fases: até 8 dias depois da última leitura ele é só um atrasado, e os dias novos não são medidos em nenhum período; do nono dia em diante ele é "parado", os dias seguintes voltam a ser medidos **sem ele** e a tela diz "N de M vídeos sem leitura depois de dd/mm"; quando o período não contém mais nenhum dia medido dele (em 7, 28 ou 90 dias), ele passa a "fora desta conta". Em "Desde {ano}" ele fica "parado" para sempre, com a linha. O preço: a regra não distingue "saiu do YouTube" de "a coleta deste vídeo falha há mais de 8 dias". No segundo caso os dias depois da última leitura são mostrados como medidos sem as views dele, que existem e não foram lidas; a tela diz a contagem e a data, o Sentry é avisado, e quando a coleta voltar o vídeo volta a ser exigido e os números desses dias sobem. É a escolha entre um número parcial com a contagem escrita e um bloco congelado sem fim; fiquei com o primeiro e a regra é uma constante (`DIAS_SEM_LEITURA`). O total do período segue a mesma regra, sobre a cobertura `base`: por isso o total e a divisão podem dizer contagens diferentes de vídeos (um vídeo com o diário em dia e a origem sem leitura entra no total e não na divisão), e cada um diz a sua.
11. *(emenda 1: S-I1)* **Toda abertura do canal próprio passa a pagar a leitura da origem**, mesmo de quem só quer a aba Vídeos. Está fora do caminho que segura a página, mas é carga de banco; se pesar, a saída (navegação de verdade na aba) está escrita na Tarefa 17.
12. *(emenda 1: D-I7)* **A janela de 7 ou 30 dias com resposta vazia** fica com uma frase que não é a do mockup até o dono responder a pergunta 1.
13. *(emenda 1: S-I2)* **O Observatório pode trazer menos vídeos do que a coleta guarda** (C-15, não medido): nesse caso "seus vídeos" é "os vídeos que o Observatório traz", e o ⓘ diz quantos.

### O que nenhum teste vai provar (declarado)

- Que a curva e a faixa mostradas correspondem ao que o YouTube Studio mostra para o mesmo vídeo. A conferência `e5b-d1` refaz a conta a partir dos pontos guardados, não a partir do Studio.
- O significado exato de `relativeRetentionPerformance` (C-8): o ⓘ da faixa depende de leitura da documentação, não de teste.
- Leitor de tela real, Safari e Opera (o navegador do dono), e a ordem completa do teclado: os testes conferem papéis e atributos; os mockups também declararam isso como não verificado. O Opera importa porque já renderizou `color-mix()` como transparente; por isso a regra de cor literal e o teste de CSS, mas o olho no Opera é do dono, na `e5b-d0`.
- Os estados "aberta" e "lida" de 7 e 30 dias com dado real, até o dono publicar um vídeo (C-2).
- O estado "origem em revisão" com dado real, se a C-5 der 0.
- Que a tabela de grupos cobre todo valor que o YouTube manda: só a C-4 e a `e5b-d7` dizem.
- O tempo real das páginas em produção com o banco de produção: a medida da Tarefa 18 é no banco local semeado.
- Que nenhum outro caminho do produto entrega o dado privado: os testes cobrem estas telas e a varredura cobre quem chama os leitores; rota nova de outra etapa que importe um leitor cai na varredura, mas código que consulte a tabela direto, sem o leitor, só a revisão pega.

### Dívida registrada (o que fica para depois, com dono)

- Agregação da origem e do % assistido no banco (função e migration), quando os trechos passarem de 2 ou a C-10 passar do teto: é etapa nova, com migration própria; quem a abre é o controlador, na conferência `e5b-trechos` ou quando a C-10 mandar.
- Tabela de artigos de país completa (hoje 60 ou mais; o resto usa "de {nome}").
- Excluir só o dia em revisão, em vez do bloco (risco 4).
- Direção por origem e taxa de clique por origem: o dono adiou; os cliques estimados já estão na tabela.
- A frase "só quem edita" nas telas, depois da E17 (pergunta 13 e as 20 ocorrências que o plano da E17 deixou fora).
- Paginação de "Ver as N leituras" acima de 27.

---

## Segurança e LGPD

| Dado | Quem lê pela tela | Como é garantido |
|---|---|---|
| Curva de retenção, comparação do YouTube, views da leitura | quem tem a prova de leitura privada (hoje: quem edita; depois da E17: também quem tem o direito) | o leitor nega sem a prova **antes** de consultar; o cliente de serviço só é criado depois da prova; o modelo de `negado` não tem número, data nem pontos; testes de HTML, propriedades e atributos |
| Origem, aparelho, país, inscritos, impressões por origem, total do período | os mesmos | idem; nível `so-aviso` sem número (pergunta 6) |
| **Termos de pesquisa e sites de fora** | **só quem edita** | entrada própria (`dados-termos.ts`) que pede a prova de edição; varredura que proíbe `lerDetalheDaOrigem` em qualquer outro arquivo; teste com termo e endereço sentinela nos três níveis |
| % assistido por período, impressões por dia (A e B) | quem tem a prova (regra de hoje da A4) | não muda |

- **RLS.** As tabelas lidas têm RLS ligada pelas migrations das outras etapas (`can_view_private_site` se existir, senão `can_edit_site`; sem política de escrita). **A barreira destas telas é o token no código**, porque a leitura usa o cliente de serviço (risco 39 do spec): por isso todo leitor novo nega antes de consultar e tem prova por mutação da guarda e de cada filtro de site e de canal. Nenhuma leitura confia no GUC `app.site_id`.
- **Termo de pesquisa pode ser nome de pessoa** (aviso do plano da E11). Fica só na tela de quem edita, nunca em tela de leitura, nunca no Sentry, nunca em rota de `api/pipeline/`. O endereço de site já chega sem o que vem depois de "?" e de "#", cortado na escrita (item 88, da E11).
- **Retenção e apagamento.** Esta etapa não grava nada no banco. O que fica no navegador são três escolhas de tela, sem dado pessoal. O apagamento de canal continua sendo o da função de impacto das migrations.
- **Sentry.** Só contagens, códigos de erro e nomes de passo. Nenhum termo, endereço, país por vídeo e dia, nem texto de exceção do banco.

---

## 14. Apêndices

### Apêndice A: consultas de conferência (não há migration; estas são as leituras de produção)

Comando do controlador, com a autorização do dono: `npx supabase db query --linked "<consulta>"`. Só leitura.

**Antes de implementar (seção 3.2).**

C-1, tabelas e função:
```sql
select to_regclass('public.yt_own_video_retention') as retencao,
       to_regclass('public.yt_own_video_coverage') as cobertura,
       to_regclass('public.yt_own_video_dim_daily') as dim,
       to_regclass('public.yt_own_video_traffic_detail_daily') as detalhe,
       to_regclass('public.yt_own_video_reach_dim_daily') as alcance_dim,
       to_regprocedure('public.can_view_private_site(uuid)') as direito;
```
Esperado em 13/10: seis nulos.

C-2, vídeos que podem ter janela de 7 ou 30 dias:
```sql
select youtube_video_id, published_at, duration_seconds
  from public.youtube_videos
 where published_at >= timestamptz '2026-09-14'   -- (emenda 1: D-m1) publicação + 29 >= 13/10/2026
 order by published_at desc;
```
Esperado: 0 linhas.

C-3, views recentes por vídeo:
```sql
select youtube_video_id,
       sum(views) filter (where day_pt >= current_date - 28) as v28,
       sum(views) filter (where day_pt >= current_date - 90) as v90,
       sum(views) as vida
  from public.yt_own_video_daily
 group by 1 order by v90 desc nulls last limit 15;
```
*(emenda 1: D-m2)* E quantos vídeos passam do corte de 500 views na vida (o `views_at_read` da janela `vida` é essa soma):
```sql
select count(*) filter (where v >= 500) as com_500,
       count(*) filter (where v >= 100) as com_100,
       count(*) as videos
  from (select youtube_video_id, sum(views) as v from public.yt_own_video_daily group by 1) t;
```

C-9, tentativas de retenção por tipo (depois da MG14 e da coleta):
```sql
select kind, outcome, count(*) from public.yt_own_collection_attempts
 where kind in ('retencao_vida','retencao_7d','retencao_30d') group by 1, 2 order by 1, 2;
```

C-10, tamanho da leitura do "Canal inteiro":
```sql
select count(*) as linhas_total,
       count(*) filter (where views > 0) as linhas_com_view,
       count(distinct youtube_video_id) filter (where views > 0) as videos_com_view,
       min(day_pt) as de, max(day_pt) as ate
  from public.yt_own_video_daily;
```
Decide a Tarefa 9: *(emenda 1: D-I6, S-I8)* `linhas_com_view` até 10.000 segue; acima, para.

*(emenda 1: S-m8)* O diário cobre a vida de cada vídeo? (primeiro dia do diário contra a publicação)
```sql
select count(*) as videos,
       count(*) filter (where d.primeiro is null) as sem_diario,
       count(*) filter (where d.primeiro > (v.published_at at time zone 'America/Los_Angeles')::date + 3) as diario_comeca_depois,
       min(d.primeiro) as primeiro_dia_do_diario
  from public.youtube_videos v
  left join (select youtube_video_id, min(day_pt) as primeiro from public.yt_own_video_daily group by 1) d
    on d.youtube_video_id = v.youtube_video_id
 where v.published_at is not null and v.channel_id = '<uuid do canal próprio>';
```
Se `diario_comeca_depois` passar de 0: o cartão é "Desde dd/mm/aaaa" e o total de "Desde {ano}" lê "não medido". (A coluna `youtube_video_id` de `youtube_videos` é suposição minha: o controlador confere com `grep -n "youtube_videos: {" -A 30 apps/web/src/types/database.types.ts` antes de rodar.)

C-15 *(emenda 1: S-I2)*, quantos vídeos o canal próprio tem no banco:
```sql
select count(*) as todos, count(*) filter (where published_at is not null) as com_publicacao
  from public.youtube_videos where channel_id = '<uuid do canal próprio>';
```
Comparar com o que o Observatório traz para o mesmo canal e com os longos acompanhados (`ownYtIds`).

C-16 *(emenda 1: D-I7)*, ao primeiro vídeo novo: alguma resposta vazia virou `ok` depois?
```sql
select scope_id, kind, attempt_day, outcome
  from public.yt_own_collection_attempts
 where kind in ('retencao_7d', 'retencao_30d')
 order by scope_id, kind, attempt_day;
```

**Depois do envio (Tarefa 19).**

K1 (`e5b-d1`), os pontos de duas curvas para refazer a conta à mão:
```sql
select youtube_video_id, window_kind, collected_at, views_at_read, point_count, points
  from public.yt_own_video_retention
 where window_kind = 'vida'
 order by views_at_read desc nulls last limit 2;
```
Esperado: a primeira posição com `ratio` abaixo de 0,5, vezes a duração, dá o "m:ss" da tela; a mediana de `relative`, arredondada a duas casas, dá o número da faixa.

K2 (`e5b-d7`), dias em revisão. *(emenda 1: D-I5)* A consulta da primeira versão partia do diário com `views > 0` e por isso nunca via o caso que procura: origem com views num dia em que o diário não tem linha (depois da dieta, dia sem atividade não tem linha) ou tem `views = 0`. Nesse dia a tela põe o bloco "em revisão" (`dimensoes-estado.ts:82-83`: sem linha, a referência é 0 e a soma é maior). Esta parte das origens e junta o diário e a cobertura `base`:
```sql
with o as (select youtube_video_id, day_pt, sum(views) as s
             from public.yt_own_video_dim_daily
            where dim_kind = 'traffic_source' and day_pt >= current_date - 14
            group by 1, 2
           having sum(views) > 0)   -- (emenda 2: D-n3) a tabela aceita linha com views = 0 e minutos assistidos > 0
select count(*) as dias_com_origem,
       sum(o.s) as soma_origens,
       sum(coalesce(d.views, 0)) as views_dia,
       count(*) filter (where o.s > coalesce(d.views, 0)) as dias_em_revisao,
       count(*) filter (where d.youtube_video_id is null) as dias_sem_linha_no_diario,
       count(*) filter (where not exists (
              select 1 from public.yt_own_video_coverage c
               where c.youtube_video_id = o.youtube_video_id and c.metric_set = 'base'
                 and o.day_pt between c.covered_from and c.covered_to)) as dias_sem_cobertura_base
  from o left join public.yt_own_video_daily d using (youtube_video_id, day_pt);
```
Esperado: `dias_em_revisao = 0` e `dias_sem_cobertura_base = 0`. `dias_sem_linha_no_diario` acima de 0 com `dias_em_revisao = 0` não existe (origem com view sem linha no diário é revisão); se aparecer, é erro da consulta. *(emenda 2: D-n3)* A frase só é verdadeira com o `having sum(views) > 0` acima: a restrição `yt_own_video_dim_daily_esparsa` (`mg7.sql:46-47`) aceita linha de origem com 0 views e minutos assistidos, que sem o `having` contaria como dia sem linha no diário sem ser revisão. Com o `having`, `dias_com_origem` conta só os dias em que alguma origem trouxe view.

K3 (`e5b-d7`), item 90: a mesma consulta nova, com `soma_origens <= views_dia` **e** `dias_em_revisao = 0` (a soma global pode fechar com um dia estourado e outro folgado; o que vale é dia a dia).

K4 (`e5b-d7`), valores reais contra a tabela de grupos:
```sql
select dim_kind, dim_value, count(*) as linhas, sum(views) as views, min(day_pt) as de, max(day_pt) as ate
  from public.yt_own_video_dim_daily
 group by 1, 2 order by 1, views desc nulls last;
```
Esperado: todo `dim_value` de `traffic_source` presente na tabela da Tarefa 7; nenhum `ZZ` em `country`.

K5 (`e5b-d28`), ruído da curva contra as views:
```sql
select r.youtube_video_id, r.window_kind, r.views_at_read, r.point_count,
       (select sum(greatest(0, (b.p->>'ratio')::numeric - (a.p->>'ratio')::numeric))
          from jsonb_array_elements(r.points) with ordinality a(p, i)
          join jsonb_array_elements(r.points) with ordinality b(p, j) on j = i + 1) as soma_subidas
  from public.yt_own_video_retention r
 order by r.views_at_read nulls first;
```
O limiar passa a ser a menor `views_at_read` a partir da qual `soma_subidas` fica abaixo de 0,10 em todas as curvas, se houver 5 curvas ou mais.

K6 (`e5b-d28`), mediana contra média da comparação:
```sql
select r.youtube_video_id, r.window_kind, r.views_at_read,
       (select percentile_cont(0.5) within group (order by (p->>'relative')::numeric) from jsonb_array_elements(r.points) p) as mediana,
       (select avg((p->>'relative')::numeric) from jsonb_array_elements(r.points) p) as media,
       (select count(*) from jsonb_array_elements(r.points) p where p->>'relative' is null) as pontos_sem_relative
  from public.yt_own_video_retention r
 where (select count(*) from jsonb_array_elements(r.points) p where p->>'relative' is null) * 2 <= r.point_count;
```
*(emenda 1: D-m7)* O `where` aplica a regra da tela ("menos da metade dos pontos com valor = sem comparação"): curva com poucos `relative` não entra na comparação entre mediana e média.

### Apêndice B: o que foi rodado para escrever este plano

Só leitura do repositório local. Um script de leitura das fixtures `c01-vida-so2.json` e `c01-comparacao-periodos.json` (mediana, média e soma das subidas: F9 e F10). Nenhuma consulta em produção, nenhum build, nenhuma suíte, nenhum navegador, nenhum commit.
