# TikTok: viabilidade de acesso a dado (conta própria e terceiros)

Data: 13/10/2026. Todas as páginas citadas foram acessadas em 13/10/2026; a data ao lado do URL é a da própria página, quando ela mostra uma.
Natureza: pesquisa de viabilidade. **Não é spec nem plano**: o spec depende da escolha de escopo do dono (seção 7) e das respostas da seção 8.
Material de base (detalhe, trechos copiados, tentativas): `.superpowers/sdd/tiktok-viabilidade/varredura-*.md` e `verificacao-*.md`.
Método de leitura: todas as páginas foram lidas por leitor que converte a página em texto e responde com trechos (WebFetch), não pelo HTML cru. Isso vale para o pesquisador, para os céticos e para os revisores. "Confirmado" quer dizer que leitores independentes receberam o mesmo trecho da mesma página oficial; não quer dizer que alguém conferiu o HTML. A única exceção é a LGPD, lida no HTML do planalto.gov.br.
Rodada 1 de revisão (dados e software) aplicada em 13/10/2026; resposta achado por achado em `.superpowers/sdd/tiktok-viabilidade/resposta-revisao-1.md`. Rodada 2 aplicada em 13/10/2026; resposta em `.superpowers/sdd/tiktok-viabilidade/resposta-revisao-2.md`.

Legenda de estado, usada em todo o documento:

| Marca | Significado |
|---|---|
| **[C]** | confirmado: dois céticos releram a fonte oficial |
| **[C1]** | confirmado por um cético só |
| **[O]** | fonte oficial lida pelo pesquisador, sem cético |
| **[P]** | parcial: entra aqui já na versão corrigida pelos céticos |
| **[NC]** | não confirmado: não lido em fonte oficial. Não é fato |
| **[pista]** | fonte não oficial (fornecedor, blog, imprensa). Não é fato |

---

## 1. Resumo de uma tela

**Veredito geral: viável só se a revisão do app aprovar, e a regra escrita aponta para recusa.** Tecnicamente dá para ter no site uma coleta da conta própria do TikTok, bem mais pobre que a do YouTube. Mas ela depende de uma aprovação cuja regra publicada exclui o caso do dono, e não há alternativa oficial documentada para uso pessoal. Para concorrentes não há via oficial aberta a um criador.

- **Conta própria, via Login Kit + Display API: condicionada à revisão.** A API entrega perfil (seguidores, seguindo, curtidas totais, número de vídeos) e, por vídeo público, só quatro contadores (views, curtidas, comentários, compartilhamentos) mais metadados. Não entrega tempo assistido, retenção, origem de tráfego, demografia nem alcance **[C]**. É gratuita hoje **[C]**. A página de revisão diz: "Apps must not be for private or personal use." e "Apps that are still in development or testing will not be approved." **[C]**. Um painel só do dono é, ao pé da letra, uso pessoal.
- **O sandbox não é plano B.** A fonte o descreve só como "a restricted environment that allows you to try out integrations"; não diz se vence, se devolve dado real nem se pode rodar de forma contínua **[O]**. Não há base para planejar a coleta permanente dentro dele.
- **O código vem antes da resposta.** A revisão exige site completo, páginas legais visíveis e vídeo do fluxo de ponta a ponta "no site ou app onde os recursos serão de fato integrados" **[C]**. Mínimo a construir antes de submeter: a conexão OAuth do TikTok, uma tela que mostre o dado lido e as páginas de Privacidade e Termos cobrindo dado de rede social. Para não pagar esse código no escuro, o passo anterior é perguntar por escrito ao suporte do TikTok for Developers se um app de um único criador é aprovável (teste T5b, seção 6).
- **Conta própria com métrica rica (retenção, tempo assistido, origem de tráfego, alcance): não confirmado.** Existiria pela Accounts API do TikTok API for Business, mas o portal `business-api.tiktok.com` não abriu nesta máquina (falha de DNS) e tudo o que se sabe dele veio por leitor intermediário. Há pista de que o cadastro recusa pessoa física. Fica fora do resumo como fato; é o primeiro teste da seção 6.
- **Concorrentes: inviável por via oficial.** A Research API, que lê conta pública de terceiro, nega acesso a criador, anunciante e usuário comercial e, no Brasil, só aceita instituição acadêmica ou ONG que estude segurança online de jovens **[C]**. A Commercial Content API é só de anúncios e o Brasil não está nos países suportados **[C]**. A Data Portability só devolve dado de usuários do EEE e do Reino Unido **[C]**. O oEmbed é público, mas não traz contador nenhum **[C]**.
- **Raspagem e provedores pagos:** os Termos de Serviço que valem para o Brasil proíbem coletar informação com scripts automatizados **[C]**. Os provedores existem e têm preço de tabela (seção 3-C), mas são raspagem terceirizada. **Recomendação padrão: não raspar.** A decisão é do dono.
- **Série diária só existe se o site coletar.** A API devolve um número por vídeo sem dizer a que período ele se refere ("Number of views of the video"). Presumido **[NC]**: é o total acumulado, e então o que se perde por dia sem coletar é só o ponto daquele dia na curva. Se for contagem de janela, perde-se o total do dia. O teste T6 (passo 8) decide.
- **A série construída é apagável por ordem do TikTok.** Encerrado o acesso, os Developer Terms mandam apagar o dado obtido pela API "em todas as formas", e a definição inclui cópias e obras derivadas **[C]**: série, capas guardadas, arquivo no NAS e backups (seção 2.3, tabela de gatilhos).
- **Custo em dinheiro:** zero na opção 1 e na parte (b) da opção 2; a parte (a) da opção 2 não tem preço lido **[NC]**; a opção 3 é paga. Esforço da opção 1: P a M, não medido (seção 7).

O que decide o escopo: a leitura das três páginas do portal Business no navegador do dono (teste T1, dez minutos, sem criar nada), a pergunta ao suporte sobre uso pessoal (T5b) e o teste em sandbox com a conta dele (T6).

---

## 2. Mapa de equivalência YouTube × TikTok

Colunas: capacidade que o site já tem no YouTube (referência na varredura `repo`), situação no TikTok por via oficial, fonte e estado.

### 2.1 Canal próprio

| Capacidade no YouTube | TikTok | Fonte e estado |
|---|---|---|
| Views por vídeo, diário (Analytics API, dia × vídeo, relê 10 dias) | **Existe menor.** `view_count` por vídeo público. A página define só "Number of ...": não diz se é total acumulado ou do dia (tratar como total de agora). Série diária só se o site coletar; histórico anterior à primeira coleta não é recuperável por esta API. Histórico de vídeos alcançável: a fonte não declara teto (não medido). Cota: 600 requisições por minuto por endpoint; a página não diz se o limite é por app, por usuário ou por token. O que a origem expira: o vídeo que deixa de ser público some da lista junto com os contadores (a página do objeto não diz o que acontece com vídeo privado ou apagado; `video/list` só devolve públicos), e o último valor só existe se o site o tiver gravado. Retenção imposta: sem prazo fixo nos Developer Terms; "não mais que o necessário" no acordo de compartilhamento **[P]** | https://developers.tiktok.com/docs/en/tiktok-api-v2-video-object (Last updated August 24, 2026) **[C]**; granularidade **[P]**; cota https://developers.tiktok.com/docs/en/tiktok-api-v2-rate-limit (August 4, 2026) **[C]** |
| Curtidas, comentários (contagem), compartilhamentos por vídeo | **Existe menor**, mesmas ressalvas da linha acima (`like_count`, `comment_count`, `share_count`) | mesma página **[C]** |
| Tempo assistido, duração média, % assistido | **Não existe na Display API** **[C]**. Pela Accounts API (Business) haveria tempo total e médio assistido e taxa de vídeo completo, acumulados na vida do vídeo: **[NC]** | Display: página do objeto Video **[C]**. Business: https://business-api.tiktok.com/portal/docs/get-post-data-of-a-tiktok-account/v1.3, não lido na fonte **[NC]** |
| Inscritos ganhos e perdidos por vídeo | **Não existe na Display API** **[C]**. Só o total de seguidores da conta (`follower_count`, escopo `user.info.stats`), valor de agora. A diferença entre duas leituras do site dá só a **variação líquida**: quem seguiu e saiu entre as leituras se anula, e ganho e perda separados não existem na Display API, nem atribuição por vídeo. Business: "novos seguidores" por vídeo e ganhos/perdidos diários da conta **[NC]** | https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info (Last updated August 4, 2026) **[C]** |
| Totais do canal (inscritos, views, vídeos) em série | **Existe menor.** `follower_count` ("User's followers count"), `following_count`, `likes_count` ("total number of likes received by the user across all of their videos") e `video_count` ("total number of publicly posted videos by the user"), todos int64, escopo `user.info.stats` **[C]**. Granularidade: valor de agora, sem série nem histórico na origem; série só se o site coletar. A página não diz se o número é exato ou arredondado (não medido). `video_count` conta só vídeo publicado como público: cai quando um vídeo vira privado ou é apagado, e a queda não é erro. Não há total de views da conta: só somando os vídeos públicos lidos. Retenção imposta: a mesma da linha de views; ver a tabela de gatilhos (seção 2.3) | mesma página **[C]**; exatidão **[NC]** |
| Alcance: impressões e taxa de clique da miniatura | **Não existe por via oficial confirmada.** Display não tem **[C]**. Business teria alcance (`reach`) mas não impressões nem CTR de miniatura **[NC]** | idem |
| Origem do tráfego | **Não existe na Display API** **[C]**. Business teria fontes (For You, Follow, Sound, Profile, Search, Others, DM), acumulado por vídeo **[NC]** | idem |
| Termos de pesquisa | **Não existe por API**: não consta em nenhuma lista de campos lida. Aparece na tela do TikTok Studio **[O]** | https://www.tiktok.com/creator-academy/en/article/tool-analytics-intro (sem data) **[O]** |
| Dispositivo | **Não existe por via oficial**: não consta em nenhum campo lido, nem na pista do Business | ausência por varredura, não por declaração oficial |
| País | **Não existe na Display API** **[C]**. Business teria países e cidades por vídeo e demografia de seguidores (foto atual, contas com 100 seguidores ou mais) **[NC]** | idem |
| Inscritos × não inscritos | **Não existe na Display API** **[C]**. Business teria "tipo de espectador" **[NC]** | idem |
| Curva de retenção por vídeo | **Não existe na Display API** **[C]**. Business teria curva por segundo, que pode vir indisponível em vídeo sem atividade há mais de 7 dias **[NC]** | idem |
| Relatórios em lote guardados em bruto (Reporting API) | **Não existe por API.** O mais próximo é o export manual do TikTok Studio: janelas de 7, 28, 60 ou 365 dias, até 365 dias por download **[P]**; formato, colunas e granularidade do arquivo não confirmados **[NC]**: não se sabe se há linha por vídeo e por dia ou só agregado do período (teste T2) | https://www.tiktok.com/creator-academy/en/article/tool-analytics-intro (sem data) |
| Metadados e versões (título, miniatura, descrição) | **Existe menor.** A API traz id, `create_time`, duração, título, descrição, capa, link de embed, `is_aigc` **[C]**. Versões só por leituras repetidas do site (como no YouTube). A URL da capa expira em 6 horas ("the link has a TTL of 6 hours") **[C1]**: é preciso baixar a imagem ou renovar por `/v2/video/query/`. Como a URL vence, ela muda entre leituras e não serve de chave para saber se a capa mudou: detectar troca exige baixar a imagem e comparar o conteúdo a cada leitura, salvo se T6 mostrar uma parte estável na URL (não medido). O que a origem expira: a URL da capa (6 h) e tudo do vídeo que deixa de ser público. Só vídeos públicos **[C]**. Retenção imposta (metadados, versões e arquivo da capa): a mesma da linha de views; ver a tabela de gatilhos (seção 2.3) | objeto Video e https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list (August 4, 2026) **[C]** |
| Comentários (texto) do próprio vídeo | **Não existe na Display API**: não há escopo de comentários na lista completa de escopos **[C]**. Business teria `comment.list` com autor identificado **[NC]** | https://developers.tiktok.com/docs/en/tiktok-api-scopes (sem data) **[C]** |

### 2.2 Concorrentes

| Capacidade no YouTube | TikTok | Fonte e estado |
|---|---|---|
| Lista de canais acompanhados e vídeos de cada canal, só com chave pública | **Não existe por via oficial.** Os endpoints da Display API exigem token do usuário que autorizou e cada usuário precisa autorizar o app **[C]**. Que não sirva para concorrente é dedução desse desenho, não frase lida **[P]** | https://developers.tiktok.com/docs/en/scopes-overview (Last updated August 19, 2026) |
| Contadores públicos de vídeo e de canal, série diária e semanal | **Não existe por via oficial para o dono.** A Research API tem esses campos, mas é fechada a criador e uso comercial **[C]**; além disso suas estatísticas levam até 10 dias para atualizar e vídeo novo até 48 h para entrar **[P]** | https://developers.tiktok.com/products/research-api/ (sem data, © 2026) **[C]**; https://developers.tiktok.com/docs/en/research-api-faq (Last updated September 1, 2026) |
| Leitura horária dos vídeos novos (curva de 72 h) | **Não existe por via oficial** | idem |
| Cerca de 12 comentários de destaque por vídeo | **Não existe por via oficial** fora da Research API **[C]** | idem |
| Versões de título e miniatura | **Existe menor, por oEmbed**: GET público com a URL do vídeo devolve título, autor, miniatura e HTML, sem contador **[C]**. Exige já conhecer a URL do vídeo (o oEmbed não lista vídeos). Cota e autenticação: a fonte não diz **[O]**. A página não descreve `thumbnail_url` (o campo só aparece no exemplo de resposta) nem diz se essa URL vence: se vencer, vale a mesma dificuldade da capa da Display API (baixar e comparar a cada leitura). Comportamento real não medido (um GET de teste deu 503) | https://developers.tiktok.com/docs/en/embed-videos (Last updated August 4, 2026) **[C]** |
| Detecção de vídeo que saiu do ar | **Existe menor, indireta**: vídeo removido do app deixa de funcionar no embed **[C]**; formato do erro não documentado, não medido | mesma página **[C]** |

### 2.3 Ciclo de vida

| Capacidade no YouTube | TikTok | Fonte e estado |
|---|---|---|
| Cota por dia (10.000 un. por dia) | **Existe diferente**: limite por minuto, não por dia. 600 requisições por minuto em cada um de `user/info`, `video/list`, `video/query`, janela deslizante; excesso dá HTTP 429 `rate_limit_exceeded` **[C]**. A página diz que os limites são "set and enforced separately" por API e **não diz se valem por app, por usuário ou por token**; com uma conta só isso não muda a decisão. Há também um teto de usuários ativos do app, citado em outra página (o FAQ: "Can I increase my active user cap?"), sem número **[O]** | https://developers.tiktok.com/docs/en/tiktok-api-v2-rate-limit (August 4, 2026) **[C]**; teto de usuários ativos: https://developers.tiktok.com/docs/en/getting-started-faq (August 4, 2026) **[O]** |
| Identidade de autor de comentário anulada aos 28 dias | **Não se aplica na opção 1**: a Display API não devolve comentário nem autor **[C]**. Valeria se entrassem comentários pela Business API **[NC]** ou por provedor | lista de escopos **[C]** |
| Regra de 30 dias para dado não autorizado | **Sem regra equivalente lida para a Display API.** A regra de atualizar a cada 30 dias e apagar o que sumiu existe só nos Termos da Research API **[C]**. Para dado autorizado, o dever de apagar aparece no término do acesso **[C]** e alcança cópias e obras derivadas; não foi achada obrigação explícita de apagar quando o usuário revoga **[P]**. Ver a tabela de gatilhos logo abaixo | https://www.tiktok.com/legal/page/global/terms-of-service-research-api/en (em vigor desde 22/01/2026) **[C]**; https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en (Last modified: Dec 26, 2025) |
| Export | **Existe menor**: export manual do Studio **[P]**; formato e granularidade não confirmados **[NC]** (T2). O export do banco do site segue igual | Creator Academy |
| Pausa de coleta e revogação | **Existe, com peça a mais**: o webhook `authorization.removed` avisa a revogação, com motivo de 0 a 5 **[P]**; o modelo `collection_status ok/reautorizar` do site serve para o estado. Para receber o aviso é preciso uma rota pública https registrada no portal, que responda 200 na hora e confira a assinatura (cabeçalho `TikTok-Signature`, HMAC-SHA256 com o `client_secret`); o TikTok reentrega por até 72 horas e pode entregar em dobro **[O]**. Sem a rota, a revogação só é percebida quando a renovação do token falha, e o erro dessa falha não está documentado (seção 4.1) | https://developers.tiktok.com/docs/en/webhooks-events, https://developers.tiktok.com/docs/en/webhooks-overview e https://developers.tiktok.com/docs/en/webhooks-verification (as três August 4, 2026) |

**Gatilhos de apagar e de parar (o que a fonte manda e o que não manda).** Vale para tudo o que a opção 1 guarda; o que muda nas opções 2 e 3 está na linha "Retenção e apagar" de cada opção (seção 7). "Alcance" é o mesmo em todas as linhas em que há dever de apagar: a série diária construída pelo site, as versões de legenda, as capas guardadas no Blob, o arquivo no NAS e os backups, porque a definição de TikTok Information inclui "any copies and derivative works thereof" **[C]**.

| Gatilho | O que a fonte manda | O que a fonte não manda (vale por LGPD ou boa prática) | Alcance |
|---|---|---|---|
| TikTok encerra ou suspende o acesso (a qualquer tempo, com ou sem aviso), ou o dono encerra o app | Developer Terms VI: cessar o uso e "delete ... TikTok Information obtained through TikTok Developer Services in all forms in your possession and control (including from our servers)" **[C]** | Prazo para apagar: a cláusula diz "immediately" para cessar o uso; para apagar não dá prazo | Tudo: série, versões, capas, NAS, backups |
| Dono revoga no app do TikTok (`authorization.removed` motivo 1) ou o desenvolvedor revoga (motivo 5) | Nada sobre apagar. A página do webhook diz só "Developers can persist this information for clean-up purposes" **[P]**. Developer Terms e Data Sharing Agreement não têm cláusula de revogação do usuário **[O]** | O titular aqui é o próprio dono: ele decide manter. Se um dia outra pessoa conectar uma conta, vale LGPD art. 15, III (término por comunicação do titular) e art. 16 (eliminação após o término) **[O]** | A coleta para; o que já foi guardado fica, por decisão do dono |
| Conta do TikTok apagada (motivo 2) ou banida (motivo 4); idade alterada (motivo 3) | Nada sobre apagar **[P]** | Boa prática: marcar a conexão como encerrada e parar; a regra de "não mais que o necessário" do acordo passa a pesar | Idem |
| Refresh token vence: 365 dias contados da emissão inicial, segundo a página ("after the initial issuance") **[C]**; se a renovação reinicia a contagem é **[NC]** (T6 passo 5a) | Nada sobre apagar **[O]**. Que o token vencido deixa de valer e o dono reautoriza é o esperado, mas o erro devolvido não está documentado **[NC]**. Estado da linha: **[P]** | Nada é apagado no site (padrão `reautorizar`) | Nenhum |
| Fim da finalidade (o dono desiste do painel) | Data Sharing Agreement, Anexo I, Parte B: "Personal Data will not be kept for longer than necessary" **[P]** | LGPD art. 15, I e art. 16: eliminar ao fim do tratamento, salvo as hipóteses de conservação do art. 16 **[O]** | Tudo |
| Pedido de titular (só existe se entrar dado de terceiro: comentário, outra conta) | Data Sharing Agreement 3.1(e): cooperar com o TikTok no atendimento de direitos de titular **[O]** | LGPD art. 18, IV e VI **[O]** | O dado daquele titular, em todas as cópias |

Consequências para o desenho: (1) tem de existir uma forma de apagar por conexão que alcance Blob, NAS e backups, o que conflita com a ideia de usar o NAS como arquivo morto de longo prazo; (2) a série da opção 1 é um ativo precário, que o TikTok pode mandar apagar; (3) o export manual do TikTok Studio não é obtido pelos Developer Services e, por leitura do autor (interpretação, não frase da fonte), não entra no dever de apagar da cláusula VI: guardá-lo fora do banco serve de cópia do histórico.

---

## 3. Respostas A a F

### A. Conta própria por API oficial: existe menor, e só se a revisão do app aprovar (a regra escrita aponta para recusa)

**O que existe (Login Kit + Display API, developers.tiktok.com):**

- Escopos de leitura da conta própria: `user.info.basic` (vem por padrão com o Login Kit), `user.info.profile`, `user.info.stats`, `video.list` **[C]**. https://developers.tiktok.com/docs/en/tiktok-api-scopes (a página não mostra data, conferido em 13/10); a frase do padrão está em https://developers.tiktok.com/doc/scopes-overview (Last updated August 19, 2026).
- Fluxo OAuth, no que difere do Google e da Meta já implementados **[O]**: URL de autorização `https://www.tiktok.com/v2/auth/authorize/` (a antiga `/auth/authorize/` está descontinuada); o identificador do app vai em `client_key`, não em `client_id`; `scope` é "A comma (,) separated string", não separado por espaço; `redirect_uri` tem de estar registrada, ser absoluta e `https`, estática ("URIs must be static. Parameters will be denied."), sem fragmento, com menos de 512 caracteres e no máximo 10 por app; `localhost` não é mencionado; PKCE (`code_challenge`, `code_verifier`) não aparece na página web. Consequências: registrar os callbacks de produção, de staging e de teste (os endereços de preview da Vercel mudam a cada deploy e não cabem em lista estática); o `state` assinado do site vai no parâmetro `state`, nunca dentro da `redirect_uri`; o teste local precisa de um endereço https. https://developers.tiktok.com/docs/en/login-kit-web (Last updated August 4, 2026).
- `/v2/user/info/`: basic dá `open_id`, `union_id`, avatares, `display_name`; profile dá `bio_description`, `profile_deep_link`, `is_verified`, `username`; stats dá `follower_count`, `following_count`, `likes_count`, `video_count` **[C]**. https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info (Last updated August 4, 2026).
- Objeto Video: quatro contadores (`view_count`, `like_count`, `comment_count`, `share_count`) e metadados. Sem tempo assistido, retenção, origem de tráfego, demografia, alcance **[C]**. https://developers.tiktok.com/docs/en/tiktok-api-v2-video-object (August 24, 2026).
- `/v2/video/list/`: POST, só vídeos públicos, ordem decrescente de criação, cursor em milissegundos, padrão 10 e máximo 20 por página **[C]**. https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list (August 4, 2026). Teto de histórico: a fonte não declara **[O]**.
- `/v2/video/query/`: até 20 ids por requisição **[O]**; a verificação de posse do vídeo consta como confirmada por um cético **[P]**.
- Granularidade: a página não define se os contadores são acumulados ou diários. O guia oficial manda um job a cada 12 horas para atualizar os vídeos recentes **[P]**. https://developers.tiktok.com/doc/display-api-get-started (Last updated August 19, 2026).
- Token: acesso vale 24 horas; renovação vale 365 dias "after the initial issuance"; `POST /v2/oauth/token/` com `grant_type=refresh_token`; "The returned `refresh_token` may be different than the one passed in the payload" e "You must use the newly-returned token if the value is different" **[C]**. https://developers.tiktok.com/docs/en/oauth-user-access-token-management (Last updated August 4, 2026). Vencidos os 365 dias contados da emissão inicial, o dono reautoriza; se a renovação reinicia essa contagem a página não diz **[NC]** (bullet seguinte e T6 passo 5a).
- **O que a página do token não diz** (conferido em 13/10, tudo **[NC]**): se o refresh token antigo é invalidado quando vem um novo; o que acontece com duas renovações ao mesmo tempo; se a janela de 365 dias reinicia a cada renovação (cada resposta traz `refresh_expires_in`, "The expiration for `refresh_token` in seconds", sem dizer o que ele vale depois da primeira); e qual é o erro de um refresh token vencido ou revogado (o único exemplo de erro é `invalid_request`, "The request parameters are malformed."). Logo, "reautorização uma vez por ano" não tem fonte: com renovação diária pode nunca ser preciso, ou pode ser preciso a cada 365 dias contados da primeira emissão.
- **Exigência para o spec, por causa disso:** a renovação do TikTok tem de ser serializada (um lease por conexão) e tem de gravar o refresh token novo **antes** de usar o access token novo. O padrão atual do site não serve como está: `refreshGoogle` em `apps/web/src/lib/social/token-refresh.ts` grava por compare-and-swap em `token_expires_at` e, quando perde a corrida, descarta a resposta e relê. Com o Google o refresh token é estável e o perdedor é inofensivo; com o TikTok o perdedor pode ter recebido o refresh token novo e jogá-lo fora (cron sobreposto com leitura sob demanda, dois terminais). E sem o código de erro documentado, não dá para mapear com segurança `TokenRevokedError` e `collection_status = reautorizar`: um erro transitório pode virar "reautorizar" e um token revogado pode ficar em nova tentativa para sempre. T6 mede os quatro pontos.
- Limite: 600 por minuto por endpoint **[C]**.
- Não há, na lista completa de escopos, nenhum escopo de insights ou analytics de criador **[C]**, e o changelog oficial (Last updated August 26, 2026) não registra API nova de analytics de criador em 2025 e 2026 **[C]**. https://developers.tiktok.com/docs/en/changelog.

**O portão de acesso:**

- É preciso aprovação dos produtos Login Kit e Display API e dos escopos **[C]**. `user.info.profile` e `user.info.stats` têm de ser adicionados no portal e enviados à revisão; sem isso, 401 `scope_not_authorized` **[P]** (boletim https://developers.tiktok.com/bulletin/user-info-scope-migration, prazo citado 29/02/2024).
- A revisão exige site completo (não landing nem tela de login), Política de Privacidade e Termos visíveis, e vídeo de demonstração de ponta a ponta (até 5 vídeos de 50 MB), em sandbox se o app nunca foi aprovado **[C]**. https://developers.tiktok.com/docs/en/app-review-guidelines (August 4, 2026).
- **A mesma página diz: "Apps must not be for private or personal use." e "Apps that are still in development or testing will not be approved."** **[C]**. Nenhuma exceção para app de um só usuário foi achada **[C1]** (relido em 13/10: não há). O vídeo tem de mostrar "the complete end-to-end flow of the up-to-date integrations" e "the website or app where the features will actually be integrated" **[C]**: a integração tem de existir e funcionar no site antes do envio. O FAQ só fala em procurar o suporte depois de uma recusa; não descreve consulta prévia **[O]**.
- Prazo: de alguns dias a duas semanas **[C]** (https://developers.tiktok.com/docs/en/getting-started-faq, August 4, 2026); as Developer Guidelines negam prazo garantido e permitem recusa por qualquer motivo **[C]** (https://developers.tiktok.com/docs/en/our-guidelines-developer-guidelines, August 4, 2026).
- Pessoa física pode registrar; organização é opcional; o registro individual é "não recomendado para integrações reais" **[C]**. Nenhuma página lida exige CNPJ **[C]**. https://developers.tiktok.com/docs/en/getting-started-create-an-app (August 4, 2026).
- Apps criados depois de 09/09/2024 precisam verificar a posse das URLs de Termos, Privacidade e site **[O]**.
- Sandbox: até 5 sandboxes e 10 contas-alvo, sem revisão; a conta própria entra informando as credenciais dela; não inclui Content Posting público nem Data Portability **[C]**. A Display API não está na lista de exclusões, mas a página não diz se devolve dado real **[C1]**. Ela também não diz se o sandbox vence nem se pode ser usado de forma contínua: descreve-o só como "a restricted environment that allows you to try out integrations" **[O]**. Não é via de produção documentada. https://developers.tiktok.com/docs/en/add-a-sandbox (August 4, 2026).
- Brasil e tipo de conta: nenhuma página lida menciona restrição de país nem tipo de conta além de "conta com alguns vídeos" **[P]**. Ausência escrita não prova disponibilidade: só teste.

**O caminho rico (Accounts API, TikTok API for Business): não confirmado.** Ver seção 4.1. O único fato oficial lido a respeito: a Organic API tem cinco partes (Accounts, Mentions, TikTok One, Discovery, Spark Ads Recommendation) e a página de ajuda não traz preço, exigência de empresa nem prazo **[C]**. https://ads.tiktok.com/resources/help/article/marketing-api (Last updated: September 2025).

**Vias sem API (conta própria):**

- Export manual do TikTok Studio: janelas de 7, 28, 60 e 365 dias, até 365 dias por download, janela personalizada na web não anterior a 2022 **[P]**. O Studio mostra origem de tráfego, termos de busca, retenção por vídeo e demografia **[O]**; não está confirmado quais delas entram no arquivo, nem se o arquivo traz linha por vídeo e por dia ou só o agregado do período **[NC]**. Enquanto T2 não responder, o export não pode ser contado como fonte do histórico diário.
- Data Portability API: só usuários do EEE e do Reino Unido **[C]**. Não serve à conta brasileira.

### B. Terceiros (concorrentes): não existe via oficial para o dono

- **Research API**: cobre vídeos visíveis a todos, comentários e contas públicas, para pesquisador independente ou acadêmico sem fins lucrativos **[P]**. Elegibilidade: acadêmicos nos EUA, EEE, Reino Unido, Canadá ou Suíça; trilha sem fins lucrativos na UE; **no Brasil, só instituição acadêmica ou ONG estudando segurança online de jovens**; exige independência de interesses comerciais **[C]**. O FAQ nega acesso a criador, anunciante ou usuário comercial **[C]**. Os Termos (em vigor desde 22/01/2026) proíbem uso comercial **[C]**. Cota: 1.000 requisições e 100.000 registros por dia; aumento só por pedido por e-mail **[P]**. Candidatar-se seria declarar um propósito que não é o real: não recomendado.
- **Commercial Content API**: anúncios, anunciantes e segmentação, não vídeo orgânico **[C]**. Países: os 27 da UE, Noruega, Islândia, Liechtenstein, Reino Unido e Suíça; **Brasil fora** **[C]**. https://developers.tiktok.com/doc/commercial-content-api-supported-countries (sem data).
- **Display API**: exige autorização de cada usuário **[C]**. Só serviria a um concorrente que fizesse login no site e consentisse, o que não é o caso de uso.
- **oEmbed**: público, sem contadores **[C]**. Serve para título, autor, miniatura e sinal de remoção de um vídeo cuja URL já se conhece.
- **Cartão de perfil embutido**: mostra seguidores, seguindo, curtidas e até 10 vídeos recentes, mas só renderizado pelo `embed.js` **[O]**; o JSON do oEmbed de perfil não traz esses números **[C1]**. Extrair do cartão renderizado seria raspagem.
- **Webhooks**: quatro eventos, nenhum de métrica ou de vídeo novo de terceiro **[P]**.
- **TikTok One / Creator Marketplace**: citado só como parte da Organic API **[C1]**; elegibilidade e campos **[NC]**.

### C. O que não existe, termos sobre raspagem, risco e provedores pagos

**O que não existe por via oficial para o dono:** qualquer dado de conta de terceiro com contador; e, até prova em contrário, analytics rico da conta própria.

**O que os termos dizem:**

- Termos de Serviço para o Brasil (versão "rest of world", Last updated 1 December 2025): proíbem coletar informação com scripts automatizados, contornar medidas de bloqueio e usar o serviço para fim comercial sem consentimento escrito **[C]**. https://www.tiktok.com/legal/page/row/terms-of-service/en. Suplemento Brasil: lei brasileira e foro nos tribunais do Brasil **[P]**.
- Developer Terms (Last modified: Dec 26, 2025): proíbem, com qualificador, robô ou spider (III.3(k): "use any robot, spider, site search or retrieval application, or other device to collect information about users of the TikTok Developer Services for any unauthorized purposes or in a manner that could affect system performance or compromise user or advertiser data"), montar perfis ou bases sobre indivíduos (III.3(h)), e usar o serviço ou o dado para competir com ou replicar serviço do TikTok (exceção: Data Portability) **[C]**. A cláusula do robô não é proibição geral de raspar: fala de informação sobre usuários dos Developer Services e depende de fim não autorizado ou de efeito sobre o sistema ou sobre dado de usuário e anunciante. **O enquadramento da raspagem vem principalmente dos Termos de Serviço** (bullet acima), não desta cláusula; a recomendação de não raspar não muda. A proibição de perfis e bases é qualificada por "para fins não autorizados ou ilegais" e fala de indivíduos; aplicá-la a série de concorrentes é interpretação **[P]**. O TikTok pode suspender o acesso sem aviso, auditar o app e exige apagar o dado ao encerrar **[C]**.
- **As mesmas cláusulas atingem a opção 1, não só concorrentes.** III.3(p): "use the TikTok Developer Services or TikTok Information to compete with or replicate any TikTok Services" **[C]**. Um painel de números da própria conta faz o que o TikTok Studio faz; se isso é "replicar um serviço do TikTok" a fonte não diz, e quem interpreta é o TikTok. II.1: "You may use TikTok Information obtained through the TikTok Developer Services solely for the purpose of developing, maintaining, and supporting your Applications" **[O]**: o dado serve ao aplicativo, e alimentar com ele outros usos (por exemplo, o pipeline de conteúdo) fica fora da frase.
- Developer Guidelines (August 4, 2026): revogação imediata e banimento permanente por violação; a página não menciona raspagem nem concorrentes **[C]**.
- Não foi achada cláusula oficial que proíba ou permita expressamente acompanhar concorrentes com dado de API: o limite é indireto.

**Risco de raspar (direto ou por provedor):** violação contratual dos Termos de Serviço; bloqueio técnico; e, se o dono tiver app de desenvolvedor, risco de perder também o acesso oficial da conta própria (os Termos de Serviço proíbem a coleta automatizada; os Developer Terms III.3(k) proíbem robô para fim não autorizado, e se raspar por provedor cai nela é leitura do TikTok; as Guidelines preveem banimento da conta e da entidade). Efeito prático (bloqueio, ação judicial) não consta nas fontes oficiais lidas. Não foi achada ação do TikTok contra raspador **[pista]**; **ausência de caso achado não mede o risco**: a busca não foi exaustiva, e os termos já dão ao TikTok a suspensão sem aviso e o banimento permanente, que não dependem de processo.

**Provedores pagos (preço de tabela lido na página do fornecedor; nenhum é fonte oficial, tudo [pista] salvo marca):**

| Provedor | Preço de tabela | Posição diante dos termos do TikTok |
|---|---|---|
| Apify (ator `clockworks/tiktok-scraper`) | a partir de US$ 1,70 por mil resultados, por evento, com adicionais pagos **[P]**. Planos Free US$ 0 (US$ 5 de uso), Starter US$ 19, Scale US$ 199, Business US$ 999: lidos por um cético só | Blog próprio (10/02/2026): raspar dado público é em geral legal, contratos podem proibir, não dá aconselhamento jurídico **[pista]** |
| EnsembleData | Free 50 unidades por dia; Wood US$ 100 por mês (1.500 por dia); Platinum US$ 1.400 (50.000). User Posts = 1 unidade por 10 posts; Post Comments = 1 unidade por 30 comentários **[P]** | A página diz acessar dado público e estar em conformidade com os termos das plataformas; não fala de parceria |
| ScrapeCreators | 100 créditos grátis; US$ 47 por 25.000 créditos (US$ 1,88 por mil); US$ 497 por 500.000 (US$ 0,99 por mil); 22 endpoints de TikTok **[P]** | Não lida na página principal |
| Exolyt (painel pronto, em reais) | Basic R$ 0 (1 conta, 1 leitura por dia, 7 dias); Essentials R$ 1.200 por mês (50 contas, 2 por dia, 90 dias, comentários); Advanced R$ 2.800 por mês (300 contas, 6 por dia) **[C1]** | Declara não ter afiliação com o TikTok; não diz a origem do dado |
| SociaVault | pacotes de US$ 29 (6.000 créditos) a US$ 399 (200.000) **[pista]** | O próprio blog (20/09/2026) diz que os termos do TikTok proíbem acesso automatizado e raspagem |
| Data365, Modash, TikAPI, Bright Data | preço não lido na página do provedor ou não publicado **[pista]** | TikAPI se chama "Unofficial TikTok API" |

**Recomendação padrão: NÃO raspar e não contratar provedor.** Motivos: os termos que valem para o Brasil proíbem; o dono é pessoa física identificada com site público; a ANPD ainda não definiu parâmetros sobre raspagem; e o ganho (contador público de concorrente) não compensa pôr em risco a conta própria. **A decisão é do dono** (pergunta 4 da seção 8).

### D. LGPD e termos

- Pelo Data Sharing Agreement (em vigor desde 22/01/2026), o desenvolvedor brasileiro é controlador independente e responde pela LGPD (transparência, base legal, direitos do titular) **[C]**. https://www.tiktok.com/legal/page/global/tiktok-data-sharing-agreement/en. Retenção "não mais que o necessário" e proibição de dado sensível constam do Anexo I, Parte B **[P]**. Transferência internacional por cláusulas-padrão ou outro mecanismo da LGPD **[O]**.
- **Os "Controller to Controller Data Terms" são este mesmo acordo.** Os Developer Terms III.5 dizem que a eles se sujeita o dado pessoal recebido, e o link da cláusula aponta para a página do Data Sharing Agreement, que se chama a si mesma "These TikTok Developer Controller to Controller Data Terms" **[O]** (conferido em 13/10). Uma diferença de nome fica registrada: os Developer Terms falam em "TikTok Personal Data" e o acordo usa "Platform Personal Data" e "TikTok Developer Services Data"; não foi achado outro documento com aquele nome.
- **O que o acordo não tem** **[O]**: cláusula de apagar ou devolver dado no término, a pedido do TikTok, a pedido do titular ou na revogação; dever de manter o dado atualizado. O dever de apagar vem só dos Developer Terms VI (tabela de gatilhos da seção 2.3).
- **Outras obrigações do acordo, relidas em 13/10** **[O]**: 3.1(d), "implement technical and organisational security measures to protect the TikTok Developer Services Data you process"; Anexo II, "You agree to implement appropriate technical and organisational measures to ensure the security", com o mínimo remetido ao Developer Agreement; 3.2, o TikTok "reserves the right to monitor your compliance with these Terms" e pode exigir "reasonable and truthful documentary evidence of your compliance"; 3.1(f) e (g), avisar o TikTok de investigação regulatória, de certos pedidos de governo e de mudança de lei que afete a proteção do dado. O Anexo I, Parte B lista categorias mais largas do que a Display API devolve: "Avatar, display name, email address, phone number, likes counts, follower count," e segue com tipo de conta, bio, aba de música e vídeos públicos; e-mail e telefone não vêm nos escopos da opção 1, e o spec não deve pedi-los. Dado sensível: "You shall not process any sensitive data or special categories of data." O leitor não achou no acordo cláusula que obrigue a avisar o TikTok de incidente de segurança (o Anexo II fala em proteger contra violação, sem dever de comunicar).
- **Incidente de segurança na LGPD** **[O]** (art. 48, lido no HTML do planalto.gov.br em 13/10): "O controlador deverá comunicar à autoridade nacional e ao titular a ocorrência de incidente de segurança que possa acarretar risco ou dano relevante aos titulares." O § 1º pede prazo razoável, "conforme definido pela autoridade nacional", e o conteúdo mínimo da comunicação (natureza dos dados, titulares, medidas de segurança, riscos, motivos da demora, medidas de mitigação). O prazo que a ANPD fixou em regulamento não foi lido **[NC]**. Na opção 1 o titular é o próprio dono; o dever pesa de verdade nas opções 2 (b) e 3, que guardam dado de terceiros, e sobre o token guardado em qualquer opção.
- **Operadores e destino do dado.** O acordo, em 3.1(h), exige que o terceiro nomeado para tratar o dado cumpra a lei de proteção de dados e os próprios termos, e o Anexo I, Parte B diz: "Access of TikTok Developer Services Data by third parties is subject to the restrictions in Your Developer Agreement" **[O]**. No site, o dado do TikTok passaria por Supabase (banco) e Vercel (funções e Blob) e, se entrar no pipeline, pelo Cowork (modelo de terceiro) e pela Gemma da forja (máquina do dono, local). Cada um desses é destino a declarar na política de privacidade e, no caso do Cowork, a decidir se recebe ou não dado do TikTok (ver II.1 na seção C). Em 3.1(e) o acordo exige cooperar com o TikTok no atendimento de direitos de titular **[O]**. A região de execução das funções e do banco não foi verificada (seção 4.1).
- **Término e eliminação na LGPD** **[O]** (lido no HTML do planalto.gov.br em 13/10): art. 15, o tratamento termina quando a finalidade é alcançada ou o dado deixa de ser necessário (I), no fim do período (II), por comunicação do titular, inclusive revogação do consentimento (III), ou por determinação da ANPD (IV); art. 16, "Os dados pessoais serão eliminados após o término de seu tratamento", com quatro hipóteses de conservação; art. 18, VI, o titular pode pedir a "eliminação dos dados pessoais tratados com o consentimento do titular, exceto nas hipóteses previstas no art. 16".
- LGPD art. 7º, IX e §§ 3º, 4º e 6º: legítimo interesse e dado manifestamente público dispensam consentimento, mas não os princípios nem os direitos do titular **[C]**. Art. 4º, I: a exclusão vale só para pessoa natural com fim exclusivamente particular e não econômico **[C]**; concluir que o site do dono fica fora da exceção é interpretação. https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm (compilado). Art. 7º § 7º e art. 33 **[C1]**.
- Resolução CD/ANPD 19/2024: cláusulas-padrão exigem texto integral; o prazo de 12 meses de adequação venceu; coleta internacional não é transferência internacional **[C]**.
- ANPD e raspagem: a Nota Técnica 1/2026 registra que parâmetros e orientações ainda não estavam definidos, com atividades em atraso previstas para 2026, e quatro processos contra agregadores abertos em 2024 **[P]**. É o estado do documento (PDF de 15/09/2026), não necessariamente o de hoje.
- Crianças e adolescentes: art. 14 e Enunciado ANPD 1/2023 exigem melhor interesse prevalecente **[P]**. Pesa para comentários e para qualquer dado de terceiro.
- **Na opção 1 o dado pessoal tratado é o do próprio dono** (perfil e vídeos dele): o risco de LGPD é baixo. Não há autor de comentário nem conta de terceiro.
- Obrigação de divulgar política de privacidade aos usuários **[O]**; o TikTok pode auditar e pedir prova de conformidade **[O]**.
- Uso comercial ou publicitário do serviço de desenvolvedor exige consentimento escrito do TikTok **[C]**. Um painel interno de análise não é venda, mas a fronteira não está definida na fonte.
- As páginas legais do site: a varredura do repositório não achou onde vive o texto publicado nem se cobre dado de rede social. Precisa ser conferido antes da revisão do app.

### E. Custo e esforço

- **Dinheiro:** a API de desenvolvedor é gratuita hoje, com reserva de cobrança futura anunciada antes de valer **[C]**. Preço da Accounts API (Business): a fonte não diz **[NC]**.
- **Prazo externo:** revisão de dias a duas semanas, sem garantia **[C]**.
- **Esforço de integração (da varredura `repo`, estado [O], lido no código em 13/10/2026):**
  - OAuth: o início e o callback são um `switch` por provedor (`google`, `meta`); TikTok entra como novo caso. Arquivos: `apps/web/src/app/api/social/oauth/[provider]/route.ts` e `.../callback/route.ts`.
  - Token: novo ramo em `apps/web/src/lib/social/token-refresh.ts` (`ensureFreshToken`), reaproveitando os erros tipados e o cofre de cifragem. O tipo `Provider` vem do pacote `@tn-figueiredo/social`, que é **pacote do workspace** (`packages/social`, versão `0.1.0-dev`, `node_modules/@tn-figueiredo/social` é symlink para ele): edita-se o fonte e roda `npm run build:packages`, **sem publicar nada**. Hoje `PROVIDERS = ['youtube', 'facebook', 'instagram', 'bluesky']` (`packages/social/src/core/types.ts:6`). O custo real é outro: `Provider` é o tipo dos **destinos de publicação** do Social Hub. Pôr `tiktok` nele quebra o typecheck em cerca de 10 `Record<Provider, ...>` exaustivos de tela de publicação (`social-config-editor.tsx`, `platform-card.tsx` com quatro, `post-card.tsx` com dois, `platform-icon.tsx`, `auto-share-dialog.tsx`, `lib/social/caption-variables.ts`) e no `switch` sem `default` de `ensureFreshToken`, e faz o TikTok aparecer como rede para publicar, que ninguém pediu. **Escolha que o spec terá de fazer:** (i) ampliar `Provider` e tratar o TikTok em todos esses lugares, ou (ii) criar um tipo próprio de conexão só de leitura e coleta, deixando `Provider` como está. A (ii) toca menos arquivos; qual das duas convive melhor com `social_connections` não foi medido.
  - Banco: `social_connections.provider` tem CHECK fechado em youtube, facebook, instagram, bluesky: exige migration (`npm run db:new`). Tabelas novas de leitura da conta própria com `can_edit_site` no select, como as `yt_own_*`.
  - Cron: a regra da A5 diz que tarefa nova é uma linha na agenda, não entrada nova no `vercel.json`. A agenda existente é específica de `competitor_*` (tabelas `competitor_agenda_runs` e `competitor_agenda_lease`, código em `apps/web/src/lib/youtube/agenda/`, cerca de 1.800 linhas, rota `api/cron/sync-youtube`). Sinal de acoplamento lido em 13/10: o contexto que toda tarefa recebe (`ContextoTarefa`, em `tipos.ts`) carrega a `apiKey` do YouTube e as `linhas` do lote de concorrentes. Uma tarefa do TikTok não usa nenhum dos dois e precisa de token por conexão; se cabe sem refatorar a agenda não foi medido, e o indício é que não cabe sem algum ajuste. O vigia dos crons só procura chaves que estão no `vercel.json`: coleta fora da agenda pode ficar sem vigia. **O precedente mais próximo é outro:** a coleta do canal próprio do YouTube (`yt_own_*`) não roda nessa agenda, e sim na rota `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` (entrada própria no `vercel.json`, `maxDuration = 300`), com o módulo `apps/web/src/lib/youtube/coleta/`: relógio de 270 s em `clock.ts`, `autorizacao.ts` (`classificarErroDeToken`, `marcarReautorizar`, `marcarAutorizado`, `voltarAOk`), `google-erro.ts` (`motivoDoGoogle`, `ehPerdaDeAutorizacao`, que traduz o erro do Google em "perdeu autorização") e `attempts.ts`. `autorizacao.ts` e `google-erro.ts` são o molde do mapeamento de erro de token do TikTok; a estimativa "P a M" parte desse molde, não da agenda. **A casa da tarefa (agenda de concorrentes, ou rota própria como a do YouTube) é decisão do spec.**
  - Padrões a espelhar: `collection_status ok/reautorizar` e a tabela de tentativas com desfecho enumerado (nunca verde por falta de dado).
- **Trabalho fora do código:** conta de desenvolvedor, verificação das URLs, registro dos callbacks (produção, staging, teste), vídeo de demonstração, texto de cada escopo, eventual ajuste das páginas legais. Mais duas linhas operacionais: (a) **segredo do app:** `client_key` e `client_secret` do TikTok são variáveis de ambiente novas (`.env.local` e Vercel), e o `client_secret` serve também para conferir a assinatura do webhook; a variável tem de existir **antes** do deploy do código que a lê (mesma regra do `PIPELINE_MCP_HMAC_SECRET`), entra em `docs/ops/env-vars.md`, e a troca de segredo precisa de procedimento escrito, porque trocar invalida ao mesmo tempo a renovação de token e a conferência do webhook (se o portal admite dois segredos ativos durante a troca não foi lido **[NC]**); (b) **rota do webhook:** tem de ler o corpo cru (o HMAC é sobre o corpo, antes de qualquer parse de JSON), ficar fora da autenticação de sessão e da resolução de site do middleware, responder 200 rápido e processar depois, e tolerar entrega em dobro.
- **Ordem do custo:** quase todo esse trabalho (conexão, uma tela, páginas legais, vídeo) tem de estar pronto **antes** de o TikTok responder à revisão, porque a revisão avalia a integração funcionando no site.
- **Volume:** o número de vídeos públicos da conta do dono não foi medido. Fórmula: uma leitura completa custa `1 + teto(N/20)` chamadas (N = vídeos públicos); em duas leituras por dia, o dobro. Para qualquer N plausível isso fica muito abaixo de 600 por minuto. Tamanho em banco: uma linha por vídeo por leitura com quatro inteiros. O banco está em 170,7 MB de 500 MB (12/10), ou seja, 329,3 MB livres, e o plano atual já depende do arquivo no NAS.
- **Cenários de volume (estimativa, não medição).** Hipótese declarada: 150 bytes por linha (quatro inteiros, identificadores, instante da leitura, chave e um índice), com uma coluna pessimista de 300 bytes. Tentativa de medir em 13/10 nos dois bancos locais, sem amostra útil: `yt_own_video_daily` está vazia no banco de integração e tem cerca de 266 linhas no outro, pouco para tirar média (o tamanho mínimo de página domina). **O N real de vídeos públicos é a primeira medição a fazer** (T4 anota o número que o perfil mostra; T6 passo 7 confere pela API).

| Cenário | Linhas por dia | Linhas por ano | MB por ano a 150 B | MB por ano a 300 B | Parte dos 329,3 MB livres (150 B) |
|---|---|---|---|---|---|
| Opção 1, N = 100, 2 leituras por dia | 202 | 73.730 | 11 | 22 | 3% |
| Opção 1, N = 300, 2 leituras por dia | 602 | 219.730 | 33 | 66 | 10% |
| Opção 1, N = 1.000, 2 leituras por dia | 2.002 | 730.730 | 110 | 219 | 33% |
| Opção 2 (b), 15 contas × 50 URLs cadastradas, 1 leitura por dia, gravando toda leitura. **Teto ilustrativo:** equivale a o dono cadastrar 750 URLs à mão; o uso realista é bem menor (dezenas de URLs) e o volume cai na mesma proporção | 750 | 273.750 | 41 | 82 | 12% |
| Opção 2 (b), mesma escala, gravando só quando título ou miniatura mudam | não medido (depende da taxa de troca) | | | | |
| Opção 2 (a), Accounts API | não medido **[NC]** | | | | |
| Opção 3, 15 contas × 50 vídeos, 1 leitura por dia | 765 (750 de vídeo + 15 de conta) | 279.225 | 42 | 84 | 13% |
| Opção 3, mesma escala, 2 leituras por dia | 1.530 | 558.450 | 84 | 168 | 25% |

  As contas: linhas por dia = N × leituras + leituras (uma linha de conta por leitura); por ano = × 365; MB = linhas × bytes ÷ 1.000.000. Não entram: a tabela de tentativas, a de versões de legenda e capa (cresce só quando algo muda) e os arquivos de capa, que vão para o Blob e não para o banco. Com N na casa do milhar, a opção 1 sozinha consome em um ano um terço do espaço livre e passa a depender do arquivamento no NAS; e o NAS, por sua vez, tem de continuar apagável (tabela de gatilhos da seção 2.3), o que impede tratá-lo como cópia que ninguém mais toca.
- **Custo de baixar capas, fora da conta de chamadas.** Como a URL da capa vence em 6 horas e muda entre leituras, saber se a capa mudou exige baixar a imagem e comparar o conteúdo: N downloads por leitura (N = 100 e 2 leituras, 200 por dia; N = 1.000, 2.000 por dia). Isso pesa no tempo da função (o orçamento do cron é acoplado), no tráfego e, quando a capa muda, no Blob. Tamanho médio da capa: não medido. **Ordem de grandeza do tempo (hipótese rotulada, não medição):** a rota de coleta do canal próprio do YouTube tem `maxDuration = 300` s e relógio interno de 270 s (`apps/web/src/lib/youtube/coleta/clock.ts`), e a rota da agenda também tem 300 s. Supondo downloads em série, sem paralelismo, a 200 ms cada (latência do CDN do TikTok a partir da Vercel: não medida): N = 100 gasta 20 s; N = 300, 60 s; N = 1.000, 200 s, ou seja, 74% do relógio de 270 s só com capas. A 500 ms cada: N = 100, 50 s; N = 300, 150 s; N = 1.000, 500 s, que não cabe em uma execução. Logo, com N na casa do milhar, baixar todas as capas a cada leitura não cabe no orçamento sem paralelismo, lote por execução ou corte por idade do vídeo; com N na casa da centena, cabe. O número de verdade só sai de T6 passo 7a (tamanho e tempo de um download) e de T4 (N). Formas de reduzir, nenhuma medida: baixar capa só dos vídeos recentes; baixar uma vez por dia e não a cada leitura; usar uma parte estável da URL como chave, se T6 mostrar que existe.

### F. Equivalência

Ver o mapa da seção 2. Em uma frase: do que o site tem para o canal próprio do YouTube, o TikTok confirma por via oficial só os quatro contadores por vídeo, os totais da conta e os metadados; do que o site tem para concorrentes, nada com contador.

---

## 4. Não confirmado e correções

### 4.1 Não confirmado (não usar como fato)

**Tudo o que vem de `business-api.tiktok.com`.** O host não resolveu nesta máquina (falha de DNS local); a primeira leitura foi por leitor intermediário e os céticos não conseguiram reler. Nenhuma afirmação abaixo foi lida na fonte direta:

1. O cadastro de desenvolvedor do API for Business não aceitaria pessoa física: exigiria empresa, site de empresa em domínio próprio e e-mail corporativo; tipos aceitos Technology Company, Direct Advertiser, Agency; resposta em 3 dias úteis.
2. Desde 20/03/2026 haveria um formulário obrigatório (Accounts API Access Application Form) antes de criar app ou pedir o escopo de contas; critérios não publicados. Um resumo de busca coincide.
3. A Accounts API atenderia conta Business e conta Pessoal.
4. `GET /business/get/`: métricas diárias da conta (views, alcance, visitas ao perfil, curtidas, comentários, compartilhamentos, seguidores ganhos e perdidos, atividade por hora) com janela máxima de 60 dias para trás; demografia como foto atual para contas com 100 seguidores ou mais.
5. `GET /business/video/list/`: métricas por vídeo acumuladas na vida do vídeo, sem série diária, parando de atualizar 365 dias após a publicação; incluiria tempo total e médio assistido, taxa de vídeo completo, curva de retenção por segundo, fontes de tráfego, países, cidades, gênero e tipo de espectador; sem impressões nem CTR de miniatura.
6. Métricas ricas indisponíveis em vídeo sem atividade há mais de 7 dias; vídeo filtrado por violação não retornado.
7. Comentários do próprio vídeo (`/business/comment/list/`) com autor identificado e webhook.
8. Token de 1 dia e renovação de 1 ano na Business API.
9. Nenhuma das cinco Organic APIs leria conta arbitrária de terceiro; TikTok One cobriria só criadores do marketplace e exigiria Partner Manager. Os endpoints "Get TTO Public Account Insights" e "Get Authorized TTO Creator Insights" existem por nome, corpo não lido.
10. Preço, cota gratuita e disponibilidade da Accounts API no Brasil.
11. Que seguidores diários, alcance e atividade horária exijam Advanced Access ou Verified Business Account (a página de entitlements lida só cita Basic Analytics).

Lidos em fonte oficial sem cético **[O]**, do mesmo assunto: latência de 24 a 48 h dos dados offline; lista de escopos de leitura do Business; limite Basic de 10 por segundo, 600 por minuto e 864.000 por dia por app; sandbox sem os endpoints orgânicos. Tratar com a mesma cautela, porque a leitura foi pelo mesmo intermediário.

O que **está** confirmado sobre o lado Business, em `ads.tiktok.com`: três níveis de conta (General, Advanced Access, Verified Business Account) e Advanced Access ao vincular a conta a uma conta TikTok for Business **[P]**; verificação de negócio disponível no Brasil, pedindo documento de empresa e identidade do representante legal **[C1]**; no Ads Manager do Brasil a validação aceita CNPJ ou CPF **[O]** (trata de conta de anúncio, não do cadastro de desenvolvedor). https://ads.tiktok.com/resources/help/article/about-tiktok-account-entitlements.

**Outros não confirmados:**

- "Baixar seus dados" do app (TXT ou JSON, link por 4 dias): página de suporte renderizada por script, não lida; não se sabe se traz views por vídeo.
- Formato, colunas e granularidade do export do TikTok Studio (se há linha por vídeo e por dia). Enquanto não confirmado, o export não conta como fonte do histórico diário.
- Se o sandbox devolve dado real para a conta própria, se vence e se admite uso contínuo.
- Se a revisão aprova pessoa física com painel de uso próprio. A regra escrita diz que não.
- Token: se o refresh token antigo é invalidado quando chega um novo; o efeito de duas renovações simultâneas; se os 365 dias reiniciam a cada renovação (logo, se existe mesmo reautorização anual); o código e o corpo do erro para refresh token vencido ou revogado.
- OAuth: se a página de autorização aceita `localhost`; se PKCE é exigido no fluxo web (a página web não o menciona).
- Se o limite de 600 por minuto vale por app, por usuário ou por token; o número do teto de usuários ativos.
- Se `follower_count` e os demais totais são exatos ou arredondados.
- Como a `cover_image_url` muda entre duas chamadas seguidas (se tem parte estável) e o tamanho médio da capa.
- Se a `thumbnail_url` do oEmbed vence.
- Termos de uso próprios do oEmbed e regra de cache ou armazenamento da resposta: a página do oEmbed não traz nenhum (só remete à especificação oembed.com e, no rodapé, aos Developer Terms gerais). Se guardar título, autor e miniatura de vídeo de terceiros ao longo do tempo (opção 2 b) é permitido, não foi lido em lugar nenhum.
- Se um painel de números da própria conta é lido pelo TikTok como "replicar" o TikTok Studio (Developer Terms III.3(p)).
- Se o export manual do Studio fica fora do dever de apagar da cláusula VI dos Developer Terms (leitura do autor, não frase da fonte).
- Se a cláusula VI e a II.1 dos Developer Terms alcançam a resposta do oEmbed (as definições I.9 e I.14 não citam embed nem oEmbed).
- Se a renovação do refresh token reinicia os 365 dias: até T6 passo 5a, o vencimento conta da emissão inicial.
- Contrato e termos de uso de qualquer provedor de raspagem (retenção, apagar ao fim da assinatura): não lidos.
- Prazo de comunicação de incidente fixado pela ANPD (o art. 48 da LGPD remete a ela): não lido. Se o portal do TikTok admite dois `client_secret` ativos durante uma troca: não lido.
- Operadores: em que região rodam as funções e o banco, e se a política de privacidade do site declara Supabase, Vercel e os modelos do pipeline como destino de dado de rede social.
- Bytes por linha das tabelas de série e N real de vídeos públicos da conta do dono.
- Disponibilidade de Login Kit e Display API para desenvolvedor e usuário no Brasil, e tipo de conta exigido.
- Se os quatro contadores são acumulados (presumido) e se `/video/list/` devolve o histórico inteiro.
- Comportamento real do oEmbed (vídeo vivo, removido, perfil, limite de taxa).
- Commercial Terms of Service do TikTok (se pessoa física pode contratar): página não lida.
- Cobertura atual da biblioteca de anúncios fora da Europa **[pista]**; aprovação lenta da Research API (21 meses relatados) **[pista]**; casos judiciais dos EUA sobre raspagem (Meta v. Bright Data, hiQ v. LinkedIn) **[pista]**; sanção da ANPD à Telekall em 2023 por raspagem **[pista]**.
- Região de execução das funções na Vercel (pesa para transferência internacional): não verificada.

### 4.2 Correções dos céticos (o que caiu ou encolheu)

| Afirmação original | Correção |
|---|---|
| "Os vídeos devolvidos são verificados como do usuário autorizado, então a API não serve para concorrentes" | A fonte só diz que cada usuário precisa autorizar e que o endpoint usa o token dele. `video/list` fala em "given user's public TikTok video posts" sem dizer se aceita outro usuário. "Não serve para concorrentes" é dedução razoável, não texto lido |
| "A Research API é a única via oficial a dado de terceiros em escala" | A página não sustenta "única"; reescrito sem a generalização |
| "Research API: 1.000 requisições por dia, sem exceções" | O texto é "não podemos conceder exceções", mas aumento de cota pode ser pedido por e-mail; seguidores e seguindo têm cota própria |
| "Estatísticas com até 10 dias de atraso inviabilizam série diária" | Os 10 dias e as 48 h estão na fonte; "inviabiliza" é inferência |
| "A Research API não traz analytics privado" | Inferência por silêncio: o codebook lista só dado público, não exclui expressamente |
| "Commercial Content API: dado só da UE" | A lista de países inclui também Noruega, Islândia, Liechtenstein, Reino Unido e Suíça |
| "Webhooks com reentrega por até 72 horas" | Não está na página de eventos (aparece na visão geral, lida sem cético) |
| "Developer Terms proíbem montar bases a partir de dado do TikTok" | A cláusula fala de indivíduos e é qualificada por fins não autorizados ou ilegais |
| "Qualquer escopo além do basic exige pré-aprovação" | Lido só o boletim sobre profile e stats; a regra geral não foi lida literalmente |
| "Guia manda atualizar por job a cada 12 horas (logo, contadores acumulados)" | O guia diz que o job atualiza os vídeos recentes; não define acumulado ou diário |
| "Sandbox exige autorizar via Login Kit" | A página diz que "pode ser preciso" |
| "`expires_in` 86400 = 24 h" na página de início | A unidade só está declarada na página de gestão de token (lá, confirmado) |
| "Export do Studio só vai até 17/07/2022 na web" | Confirmado só "não anterior a 2022" |
| "Data Portability: revisão de 3 a 4 semanas e checagem de empresas genuínas" | Estão em outras páginas (get-started e FAQ), não na de produto |
| "EnsembleData declara não ter parceria oficial" | A página não fala de parceria |
| "ScrapeCreators admite que a ferramenta não autoriza ignorar os termos" | Não achado na página principal |

Nenhuma afirmação saiu marcada como refutada por inteiro.

---

## 5. Riscos

1. **Revisão do app recusada.** A regra "não pode ser para uso privado ou pessoal" está escrita **[C]** e a recusa pode vir por qualquer motivo **[C]**. O caso do dono é, ao pé da letra, o caso recusado. Consequência: a opção 1 não existe. O sandbox não a substitui: a fonte não diz que ele dura, que devolve dado real nem que admite coleta contínua. E o custo vem antes da resposta: conexão, tela, páginas legais e vídeo têm de estar prontos para submeter. Mitigação única e parcial: perguntar ao suporte antes de construir (T5b); a resposta do suporte não vincula a revisão.
2. **Sandbox não devolver dado real.** A fonte silencia. Se não devolver, não há como validar nada antes da revisão.
3. **Token.** Acesso de 24 horas: toda coleta passa por renovação. O refresh token pode mudar a cada renovação **[C]**: se o novo não for gravado, a conexão morre. A fonte não diz se o antigo é invalidado nem o que acontece em renovação concorrente **[NC]**, e o padrão de renovação do site (compare-and-swap que descarta a resposta do perdedor) pode jogar fora o refresh token válido: o spec tem de exigir renovação serializada e gravação antes do uso (seção 3-A). O refresh vale 365 dias da emissão; se a janela reinicia a cada renovação não está na fonte **[NC]**, então "reautorização anual" é hipótese. O erro de token revogado ou vencido não está documentado **[NC]**. O padrão do site (`reautorizar`, nada é apagado) cobre o estado depois da falha, não a corrida que a causa.
4. **Mudança unilateral e perda do que foi guardado.** O TikTok pode suspender sem aviso, auditar e passar a cobrar **[C]**. No término, manda apagar o dado obtido pela API "in all forms", incluídas cópias e obras derivadas **[C]**: a série diária, as capas, o arquivo no NAS e os backups. A série da opção 1 é um ativo precário. Os escopos de perfil e stats já mudaram uma vez (boletim com prazo em 29/02/2024). A operação dos EUA mudou de dono em 23/01/2026 **[O]**; não foi achada mudança para desenvolvedor fora dos EUA.
5. **Termos e bloqueio (só se houver raspagem ou provedor).** Violação dos Termos de Serviço **[C]**; risco de banimento permanente da conta de desenvolvedor e da entidade **[O]**, o que derrubaria também a coleta oficial.
6. **LGPD.** Baixo na opção 1 (dado do próprio dono). Sobe com comentários e com qualquer dado de terceiro: controlador independente **[C]**, menores de idade no público **[P]**, ANPD sem orientação final sobre raspagem **[P]**.
7. **Falha em verde.** Vídeo privado ou removido some da lista sem erro; contador ausente não é zero; capa expira em 6 horas **[C1]**. Sem a tabela de tentativas com desfecho, a tela mostraria "ok" com dado faltando.
8. **O que se perde por dia sem coletar.** Na Display API, presumindo contador acumulado **[NC]**: o ponto daquele dia na curva de cada vídeo e dos seguidores, e o total não se perde. Se o contador for de janela, perde-se o total do dia, sem volta. T6 passo 8 decide (dois dias seguidos comparados com o Studio). Em qualquer caso: as versões de legenda e capa trocadas naquele dia; o último valor de um vídeo que saiu do público; e, com duas leituras por dia, a forma da curva das primeiras 72 horas de um vídeo novo (seis pontos em vez de 72). Se a Accounts API existir como descrita **[NC]**: o diário da conta mais antigo que 60 dias expiraria na origem, e a métrica rica de vídeo pararia de atualizar 365 dias após a publicação. Hoje, sem nada coletado, o histórico diário anterior **pode** existir no export manual do Studio (até 365 dias por arquivo **[P]**), mas isso depende de T2: se o arquivo vier agregado por período, e não por vídeo e por dia, esse histórico não é recuperável e a mitigação não existe **[NC]**.
9. **Decisão em cima de pista.** O caminho rico inteiro está não confirmado: decidir escopo antes do teste T1 é decidir no escuro.
10. **Replicar serviço do TikTok (atinge a opção 1).** Developer Terms III.3(p) proíbem usar o serviço ou o dado para "compete with or replicate any TikTok Services" **[C]**. Um painel de analytics da própria conta faz o que o TikTok Studio faz. A fonte não define a fronteira; a leitura é do TikTok e pode aparecer na revisão ou depois dela, como motivo de suspensão. II.1 limita o uso do dado a desenvolver, manter e dar suporte ao aplicativo **[O]**. Sem mitigação além de descrever o app pelo que ele acrescenta (o dado do TikTok ao lado do YouTube e do calendário do criador), não como um Studio alternativo.
11. **Volume.** Com N de vídeos na casa do milhar, a opção 1 gasta em um ano cerca de um terço do espaço livre do banco (estimativa, seção 3-E), e baixar capas a cada leitura pesa no tempo do cron. N não foi medido.

---

## 6. Testes que o dono precisa autorizar

Nada abaixo foi executado. Ordem do mais barato para o mais caro.

**T1. Ler as três páginas do portal Business no navegador (10 minutos, só leitura, sem conta).**
1. Abrir https://business-api.tiktok.com/portal/docs/register-as-a-developer/v1.3 e copiar as frases sobre "personal website", "individual developers", "company domain email" e os tipos de usuário aceitos. Anotar a data do rodapé.
2. Abrir https://business-api.tiktok.com/portal/docs/get-profile-data-of-a-tiktok-account/v1.3 e conferir: a nota de 20/03/2026 sobre o formulário; "maximum supported look-back period is 60 days"; quais métricas dizem exigir Advanced Access ou Verified Business Account.
3. Abrir https://business-api.tiktok.com/portal/docs/get-post-data-of-a-tiktok-account/v1.3 e conferir: "aggregated over the lifetime of the video"; "stop updating 365 days after"; os campos `video_view_retention`, `impression_sources`, `total_time_watched`, `full_video_watched_rate`.
4. Se aparecer o link do formulário de acesso (em `accounts-api/v1.3`), só olhar as perguntas, sem enviar.
5. Se o navegador também não abrir, tentar https://ads.tiktok.com/marketing_api/docs?id=1739381752529922 ou outra rede.
Resultado esperado: sai da lista de não confirmados o item que mais muda o escopo.

**T2. Export manual do TikTok Studio (sem app, sem credencial nova).**
1. TikTok Studio na web, Analytics, escolher 365 dias, baixar.
2. Registrar: formato do arquivo, colunas, **se há linha por vídeo e por dia** (ou só o agregado do período), se traz retenção e origem de tráfego.
3. Repetir com 60 dias.
Resultado: diz se existe um caminho manual para o histórico e para métricas que a API não dá. É a resposta de que depende o risco 8: sem linha por vídeo e por dia, o histórico anterior à primeira coleta está perdido.

**T3. "Baixar seus dados" do app.** Configurações e privacidade, Conta, Baixar seus dados, formato JSON, pedir; quando chegar, ver se há visualizações por vídeo.

**T4. No app: tipo de conta e Analytics.** Configurações, Conta: anotar se a conta é Pessoal ou Business e se o Analytics está ligado. Anotar também quantos vídeos públicos o perfil mostra: é o N que dimensiona o volume (seção 3-E). Não vincular a conta a TikTok for Business ainda: não se sabe se isso troca o tipo da conta e restringe a biblioteca de músicas (conta Business só vê a Commercial Music Library **[O]**).

**T5. oEmbed ao vivo (GET público, sem conta).**
1. `GET https://www.tiktok.com/oembed?url=<vídeo vivo do dono>`: guardar status, cabeçalhos e JSON.
2. O mesmo com um vídeo removido ou id inexistente.
3. O mesmo com URL de perfil (`https://www.tiktok.com/@<handle>`) e com link curto.
4. Repetir a partir de uma função da Vercel (o IP muda).
5. Trinta chamadas em um minuto para ver se há limite.
6. Duas chamadas seguidas ao mesmo vídeo, e uma terceira 7 horas depois: comparar a `thumbnail_url` (muda? tem parte estável?) e tentar abrir a URL antiga (venceu?).
Critério: vivo 200, removido com erro distinto e estável = detector de "saiu do ar" e de troca de legenda e capa. Se a `thumbnail_url` muda a cada chamada, detectar troca de miniatura exige baixar e comparar a imagem.

**T5b. Pergunta por escrito ao suporte do TikTok for Developers, antes de qualquer código (sem criar app).** O FAQ cita uma "Support page" do portal; o endereço não foi conferido. Texto sugerido: "Sou um criador individual no Brasil. Quero conectar a minha própria conta do TikTok ao meu site, por Login Kit e Display API (`user.info.stats`, `video.list`), para ver os meus próprios números. O app teria um único usuário, eu. As diretrizes de revisão dizem que o app não pode ser para uso privado ou pessoal. Um app assim é aprovável? Se não, existe outra via oficial para um criador ler os próprios dados por API?" Guardar a resposta inteira. Resultado: decide se vale construir a conexão, a tela e as páginas legais que a revisão exige. Limites: o suporte pode pedir login para abrir o chamado (aí passa a depender da autorização de T6), pode não responder, e a resposta não obriga a equipe de revisão.

**T6. Sandbox com a conta própria (exige criar conta de desenvolvedor e informar o login da conta TikTok: decisão do dono).**
1. Entrar em developers.tiktok.com com a conta do dono; criar o app (individual), com URL do site e redirect URI https estático.
2. Alternar para Sandbox, criar o sandbox, adicionar Login Kit e Display API e os escopos `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`. Anotar quais o painel deixa marcar sem aprovação.
3. Adicionar a conta do dono como conta-alvo; esperar até 1 hora.
4. Abrir a URL de autorização; anotar a tela de consentimento e qualquer bloqueio por país ou tipo de conta.
5. Trocar o código em `POST /v2/oauth/token/`; anotar `expires_in` e `refresh_expires_in`.
5a. Renovar uma vez (`grant_type=refresh_token`) e anotar: o refresh token mudou? `refresh_expires_in` voltou cheio (janela reiniciada) ou menor (contando da primeira emissão)?
5b. Se o refresh token mudou, tentar renovar de novo com o **antigo** e copiar o status e o corpo inteiro da resposta (o antigo ainda vale?).
5c. Disparar duas renovações ao mesmo tempo com o mesmo refresh token; anotar as duas respostas e qual dos tokens devolvidos continua valendo.
5d. Renovar com um refresh token inválido (um caractere trocado) e copiar status e corpo: é o erro que o site terá de reconhecer como "reautorizar". No fim do teste, revogar (`POST /v2/oauth/revoke/`), tentar renovar e copiar o erro de token revogado.
5e. Na URL de autorização, anotar se `redirect_uri` com `http://localhost` é aceita e se o fluxo funciona sem `code_challenge`.
6. `GET /v2/user/info/` com todos os campos; anotar o que vem preenchido, nulo ou com erro.
7. `POST /v2/video/list/` com os quatro contadores e `max_count: 20`, paginando até `has_more=false`. Comparar o total com o número real de vídeos públicos (é o N do dimensionamento) e com `video_count`. Anotar se `follower_count` bate com o número exato do Studio ou vem arredondado.
7a. Chamar `video/list` duas vezes seguidas e comparar a `cover_image_url` do mesmo vídeo: é idêntica, muda só a assinatura ou o prazo, ou muda inteira? Baixar uma capa e anotar o tamanho em bytes. Sete horas depois, tentar abrir a URL antiga.
8. Repetir em dois dias seguidos, anotando o instante de cada leitura, e comparar com o TikTok Studio: o `view_count` é o total acumulado do vídeo ou a contagem de uma janela? Disso depende o que se perde por dia sem coletar (risco 8). Chamar `video/query` com um id para ver a renovação da capa.
9. Registrar tudo em arquivo; não guardar token no repositório.

**T7. Enviar a revisão do app (só depois de T5b e T6 e com autorização separada).** Fora a resposta do suporte em T5b, é o único dado que existe sobre a regra de uso privado. **Não é um teste barato:** para enviar é preciso já ter no site a conexão OAuth do TikTok, uma tela mostrando o dado, as páginas de Privacidade e Termos ajustadas e o vídeo do fluxo completo gravado em sandbox. Se a recusa vier, esse trabalho fica sem uso.

**T8. Pergunta por escrito ao suporte do API for Business (só se T1 mostrar que vale a pena).** "Um criador individual brasileiro, com MEI ou CNPJ, site próprio e e-mail no domínio do site, é elegível para registrar-se como desenvolvedor e pedir a Accounts API só para ler os dados da própria conta?"

**T9. Conta grátis em um provedor (só se o dono decidir avaliar a opção 3).** Testar um perfil público do próprio dono para ver campos e latência. Exige aceitar os termos do provedor.

---

## 7. Três opções de escopo

Comparação de esforço: P, M ou G em relação ao que já foi feito para o YouTube (canal próprio + observatório de concorrentes).

### Opção 1. Mínimo: só conta própria, Login Kit + Display API

- **Entrega:** conexão OAuth do TikTok; totais da conta (seguidores, seguindo, curtidas, vídeos) em série diária, com a variação líquida de seguidores entre leituras (não ganho e perda separados); por vídeo público, views, curtidas, comentários e compartilhamentos em série diária construída pelo site; metadados e versões de legenda e capa (com arquivo da capa); detecção de vídeo que deixou de ser público; estado `reautorizar`.
- **Condição de existência:** aprovação na revisão do app, cuja regra escrita exclui uso pessoal. Sem ela, nada disto roda em produção.
- **O que a série vale:** é apagável por ordem do TikTok. No término do acesso os Developer Terms mandam apagar o dado obtido pela API em todas as formas, incluídas cópias e derivados: série, capas, NAS e backups (seção 2.3). O export manual do Studio, guardado à parte, serviria de cópia do que ele trouxer (T2): que ele fique fora do dever de apagar da cláusula VI é interpretação do autor, não frase da fonte **[NC]** (seções 2.3 e 4.1).
- **Retenção e apagar:** o que a fonte manda: sem prazo fixo de retenção nos Developer Terms; "não mais que o necessário" no acordo de compartilhamento **[P]**; apagar tudo no término do acesso (Developer Terms VI) **[C]**. Gatilhos: os da tabela da seção 2.3. Alcance: série, versões, capas no Blob, NAS e backups.
- **Não entrega:** tempo assistido, retenção, origem de tráfego, termos de busca, dispositivo, país, alcance, seguidores por vídeo, ganho e perda de seguidores separados, texto de comentário, qualquer dado de concorrente, histórico diário anterior à primeira coleta.
- **Esforço: P a M, não medido.** A parte mais incerta é a revisão, mas o código vem antes dela. Peças, pela ordem em que aparecem:
  1. Conexão: caso `tiktok` no início e no callback do OAuth, com `client_key`, escopos por vírgula e `redirect_uri` estática registrada para produção, staging e teste.
  2. Token: renovação serializada (lease por conexão) que grava o refresh token novo antes do uso; mapeamento dos erros do TikTok para os erros tipados do site (erro de token revogado não documentado); molde: `apps/web/src/lib/youtube/coleta/autorizacao.ts` e `google-erro.ts`.
  3. Tipo: ampliar `Provider` (cerca de 10 arquivos de tela de publicação) ou criar tipo próprio de conexão de leitura. Decisão do spec.
  4. Migration: CHECK de `social_connections.provider`; tabelas novas com `can_edit_site`.
  5. Tabelas: série da conta; série por vídeo; versões de legenda e capa; tentativas com desfecho enumerado; execuções. O equivalente do YouTube usa pelo menos quatro (`yt_own_collection_attempts`, `yt_own_collection_runs`, `yt_own_video_daily`, `yt_own_video_meta_daily`); "uma ou duas tabelas" não se sustenta.
  6. Coleta: leitura de `user/info` e `video/list` paginado; detecção de vídeo que saiu do público por ausência na lista (sem falhar em verde).
  7. Capa: baixar, comparar conteúdo e guardar no Blob.
  8. Agenda: tarefa nova. Duas casas possíveis, decisão do spec: a agenda de concorrentes, que carrega contexto do YouTube e pode pedir ajuste (não medido), ou uma rota própria no molde de `api/cron/sync-analytics-metrics` com `lib/youtube/coleta/` (relógio de 270 s, tentativas com desfecho).
  9. Vigia do cron: a coleta tem de entrar no que o vigia enxerga (na rota própria, por entrada no `vercel.json`, como a do YouTube).
  10. Revogação: rota pública de webhook com conferência de assinatura (corpo cru para o HMAC, fora da sessão e do middleware de site, 200 rápido, idempotente), ou detecção só pela falha de renovação. `client_secret` em variável de ambiente criada antes do deploy.
  11. Apagar: rotina que elimina por conexão no banco, no Blob e no NAS.
  12. Para a revisão: uma tela que mostre o dado, páginas legais ajustadas, vídeo do fluxo.
- **Volume de dado:** uma linha por vídeo público por leitura, mais uma linha de conta por leitura. Estimativa a 150 bytes por linha e duas leituras por dia: N = 100, 202 linhas por dia, 73.730 por ano, cerca de 11 MB por ano; N = 300, 33 MB; N = 1.000, 730.730 linhas, cerca de 110 MB por ano, um terço do espaço livre do banco. N não medido; bytes por linha não medidos. Tabela completa na seção 3-E.
- **Chamadas:** `1 + teto(N/20)` por leitura à API. Limite de 600 por minuto por endpoint: folga larga. **Mais os downloads de capa:** até N por leitura (N = 100 e duas leituras, 200 por dia), que não são chamadas à API mas gastam tempo de função e tráfego; tamanho da capa não medido. Ordem de grandeza por hipótese (200 ms por download, em série): N = 100, 20 s; N = 1.000, 200 s de um limite de 300 s por execução (conta na seção 3-E).
- **Perde por dia sem coletar:** presumindo contador acumulado **[NC]**, o ponto do dia na curva de cada vídeo e dos seguidores (se for contador de janela, o total do dia); versões de legenda e capa trocadas no dia; o último valor de vídeo que saiu do público. Com duas leituras por dia perde-se também a resolução da curva das primeiras 72 horas de vídeo novo. Grava-se o **instante** de cada leitura; o "dia" da série é o dia em America/Sao_Paulo, derivado do instante, nunca só uma data.
- **Custo em dinheiro:** zero hoje.
- **Integração:** as peças 1 a 11 acima. O pacote `@tn-figueiredo/social` é do workspace e não precisa ser publicado.
- **Riscos:** revisão recusada pela regra de uso privado, com o código já pago; sandbox sem dado real e sem garantia de duração; refresh token rotativo com corrida de renovação; leitura do painel como réplica do TikTok Studio (Developer Terms III.3(p)); série apagável por ordem do TikTok; capa que expira em 6 horas.

### Opção 2. Conta própria + o que houver de oficial para terceiros

- **Entrega:** tudo da opção 1, mais: (a) se T1 e T8 confirmarem, a Accounts API com métrica rica da conta própria; (b) para concorrentes, só o que o oEmbed dá: título, autor, miniatura e sinal de remoção de vídeos cuja URL o dono cadastrar à mão.
- **Não entrega:** contador de concorrente (views, curtidas, seguidores), descoberta automática de vídeos novos de concorrente, comentários de terceiros, curva de 72 h. A parte (a) pode não existir para pessoa física.
- **Retenção e apagar:** (a) Accounts API: termos do portal Business não lidos **[NC]**; nenhuma regra de retenção ou de apagar pode ser afirmada. (b) oEmbed: nenhuma regra própria lida (a página não traz termos de uso nem regra de cache; o rodapé remete aos Developer Terms gerais). **Se a cláusula VI alcança a resposta do oEmbed é [NC]:** a cláusula manda apagar "TikTok Information obtained through TikTok Developer Services"; os Developer Terms definem Developer Services como "the TikTok Developer Site, TikTok Developer Documentation, and TikTok API" (I.9) e TikTok Information como o que chega "through the TikTok API or by any other means authorized by TikTok" (I.14) **[O]**, e em nenhum dos dois o leitor achou menção a embed ou oEmbed. O oEmbed é chamado sem app e sem token, o que aponta para fora; está documentado no portal de desenvolvedor, o que aponta para dentro. A fonte não decide. Planejar pelo pior caso: se o acesso de desenvolvedor (opção 1) terminar, tratar título, autor e miniatura guardados como alcançados e apagá-los junto. Pela LGPD **[O]**: o autor do vídeo é dado pessoal de terceiro; gatilhos são o fim da finalidade (arts. 15, I e 16) e o pedido do titular (art. 18, IV e VI); alcance, as linhas daquele autor e as miniaturas no Blob, no NAS e nos backups. Vídeo que sai do ar: nenhuma fonte lida manda apagar o que foi guardado dele; a boa prática é não manter além do necessário.
- **Esforço: P para (b); M a G para (a)**, e (a) só é estimável depois de T1: seria um segundo app, em outro portal, com outro cadastro, outros escopos e normalização de retenção, fontes e demografia.
- **Volume de dado:** (b) uma linha por vídeo cadastrado por leitura, sem contador; com 15 contas e 50 URLs de cada (teto ilustrativo: são 750 URLs cadastradas à mão, e o uso realista é bem menor), uma leitura por dia e gravando toda leitura: 750 linhas por dia, 273.750 por ano, cerca de 41 MB por ano a 150 bytes (estimativa); gravando só quando título ou miniatura mudam, bem menos, não medido. (a) não medido.
- **Chamadas:** (b) uma por vídeo cadastrado por leitura; cota do oEmbed: a fonte não diz. Se a `thumbnail_url` vencer (a fonte não diz, T5 passo 6), soma-se um download de imagem por vídeo por leitura. (a) não medido.
- **Perde por dia sem coletar:** (b) versões de legenda e capa de concorrentes trocadas no dia. (a) se confirmado, o diário de conta mais antigo que 60 dias.
- **Custo em dinheiro:** zero em (b). Em (a), sem preço lido **[NC]**.
- **Integração:** como a opção 1; (b) acrescenta cadastro manual de URLs e uma tarefa de agenda; (a) acrescenta um segundo fluxo OAuth e tabelas por dimensão, e possivelmente comentários com autor (retenção de 28 dias).
- **Riscos:** (a) depender de um cadastro que talvez recuse pessoa física, de vincular a conta a TikTok for Business (efeito sobre o tipo de conta e as músicas não medido) e de um formulário sem critério publicado; (b) valor baixo para o trabalho de cadastrar URLs à mão, comportamento do oEmbed não medido, e guardar ao longo do tempo título, autor e miniatura de vídeos de terceiros sem que exista termo de uso do oEmbed lido que o permita ou proíba (seção 4.1); o autor é dado pessoal de terceiro, com o dono como controlador.

### Opção 3. Com provedor pago para concorrentes

- **Entrega:** opção 1 para a conta própria, mais lista de vídeos e contadores públicos de contas de terceiros (e, conforme o provedor, comentários), em frequência diária.
- **Não entrega:** nada de analytics privado de terceiro (não existe em lugar nenhum); garantia de continuidade; conformidade com os termos do TikTok.
- **Retenção e apagar:** do TikTok, nenhuma regra de retenção ou de apagar lida para dado raspado: os Termos de Serviço proíbem a coleta **[C]** e não tratam do que fazer com o dado coletado; a regra de 30 dias é da Research API e não se aplica. Do provedor: contrato e termos de uso não lidos **[NC]** (podem impor prazo, proibir revenda ou exigir apagar ao fim da assinatura). Pela LGPD **[O]**: nome, usuário e bio de conta de pessoa natural, e autor de comentário se vier, são dado pessoal de terceiro com o dono como controlador; gatilhos: fim da finalidade ou saída da opção 3 (arts. 15, I e 16), pedido do titular (art. 18, IV e VI), e, por analogia com o YouTube e não por regra lida, a anulação da identidade de autor de comentário; incidente de segurança, art. 48. Alcance: tabelas de concorrentes do TikTok, miniaturas no Blob, NAS e backups. Se o provedor some: a coleta para e o que está guardado segue sob a LGPD, sem fonte nova. **Encadeamento que só existe nesta opção:** se o TikTok encerrar a conta de desenvolvedor por causa da raspagem (as Guidelines preveem revogação e banimento; que a raspagem por provedor leve a isso é risco, não frase lida), a cláusula VI manda apagar também a série da opção 1 **[C]**: a opção 3 põe em risco de apagamento o dado da conta própria, não só a coleta futura.
- **Esforço: M.** Um cliente de API a mais e tabelas espelhando as de concorrentes do YouTube; a agenda atual é específica do YouTube.
- **Volume e chamadas:** o número de contas não foi definido. Conta ilustrativa, supondo 15 contas (o tamanho do observatório do YouTube hoje) e os 50 vídeos mais recentes de cada: na EnsembleData seriam 75 unidades por dia (acima do grátis de 50, dentro do plano de US$ 100 por mês); na Apify, 750 resultados por dia, cerca de 22.500 por mês, da ordem de US$ 38 por mês à tabela de US$ 1,70 por mil, sem os adicionais. É aritmética sobre preço de tabela, não medição. Duas limitações dessa conta: (1) só os 50 vídeos mais recentes de cada conta têm série; um vídeo que sai dessa janela para de ser lido e a curva dele acaba ali; (2) as 75 unidades e os 750 resultados não incluem a leitura do perfil (seguidores e totais) de cada conta, que é pelo menos uma chamada a mais por conta por dia (15 por dia), com preço por provedor não lido. Em banco, a 150 bytes por linha (estimativa): 765 linhas por dia, 279.225 por ano, cerca de 42 MB por ano; com duas leituras por dia, 84 MB.
- **Perde por dia sem coletar:** o ponto do dia na curva de cada vídeo de concorrente; e a série inteira dos vídeos que já saíram da janela dos 50 mais recentes.
- **Custo em dinheiro:** de dezenas a cerca de cem dólares por mês nessa escala; o painel pronto da Exolyt custa R$ 1.200 por mês para 50 contas. Quebra o custo zero.
- **Integração:** como a opção 1, mais chave do provedor em variável de ambiente, tabelas de concorrentes do TikTok com `can_view_site` na leitura, regra de retenção e de identidade de autor de comentário igual à do YouTube.
- **Riscos:** os Termos de Serviço para o Brasil proíbem coleta automatizada **[C]**; possível perda da conta de desenvolvedor e, com ela, da opção 1; dado pessoal de terceiros com o dono como controlador; provedor some ou muda de preço sem aviso. **Não recomendada.**

---

## 8. Perguntas ao dono

1. **Qual opção de escopo?** Padrão recomendado: opção 1, com a parte (b) da opção 2 só se o teste T5 mostrar que o oEmbed se comporta bem. Trava: todo o spec.
2. **Autoriza T1 a T5 agora (leitura e export, sem criar conta)?** Padrão: sim. Trava: a decisão sobre a Accounts API e o que o export manual cobre.
3. **Autoriza criar a conta de desenvolvedor e o sandbox com a sua conta do TikTok (T6), o que exige informar o login dela no portal?** Padrão: sim, depois de T1 e da resposta de T5b. Trava: saber se a opção 1 funciona antes de escrever o spec.
4. **Raspagem ou provedor pago para concorrentes?** Padrão: não. Trava: nada; com "não", concorrentes ficam só no YouTube.
5. **Aceita pagar por dado de TikTok?** Padrão: não (custo zero até aqui). Trava: a opção 3.
6. **Se a Accounts API exigir empresa, vale usar CNPJ ou MEI e e-mail no domínio do site?** Padrão: decidir só depois de T1. Trava: a parte (a) da opção 2.
7. **Aceita vincular a conta a TikTok for Business, se for o caminho para a métrica rica, mesmo com risco de restringir as músicas?** Padrão: não, até o efeito ser medido em T4. Trava: a parte (a) da opção 2.
8. **Como descrever o app na revisão, dado que "uso privado ou pessoal" é motivo de recusa?** Padrão: descrever com verdade o que ele é (ferramenta do site para o criador conectar a própria conta e ver seus números ao lado dos de outras redes), sem inventar público e sem apresentá-lo como substituto do TikTok Studio, porque os Developer Terms III.3(p) proíbem "replicar" serviço do TikTok. Antes disso, perguntar ao suporte (T5b). Trava: o envio da revisão (T7).
9. **Frequência de leitura da conta própria?** Padrão: duas vezes por dia (o guia oficial fala em 12 horas), com leitura horária dos vídeos novos só se o dono pedir. Com duas leituras por dia a curva das primeiras 72 horas de um vídeo novo fica com seis pontos. Cada leitura grava o instante; o dia da série é o de America/Sao_Paulo. Trava: o desenho da tarefa na agenda e o volume.
10. **Guardar a imagem da capa a cada troca, como no YouTube?** Padrão: sim, porque a URL expira em 6 horas. Custo: saber se trocou exige baixar a capa de cada vídeo a cada leitura (até N downloads por leitura), salvo se T6 mostrar parte estável na URL; alternativa mais barata, baixar uma vez por dia ou só dos vídeos recentes. Trava: uso do Blob, tempo do cron e o desenho de versões.
11. **Quantas contas do TikTok o dono tem para conectar?** Padrão: uma. Trava: a chave única da conexão e a tela.
12. **As páginas legais do site já falam de dado de rede social conectada?** Padrão: revisar e ajustar antes da revisão do app. Trava: T7.
13. **Perguntar ao suporte do TikTok for Developers antes de escrever código (T5b)?** Padrão: sim. Trava: a decisão de construir a conexão, a tela e as páginas legais que a revisão exige.
14. **`tiktok` entra no tipo `Provider` (vira rede do Social Hub, toca cerca de 10 arquivos de publicação) ou ganha um tipo próprio de conexão só de leitura?** Padrão: tipo próprio, porque só se pediu leitura. Trava: a migration e o desenho da conexão.
