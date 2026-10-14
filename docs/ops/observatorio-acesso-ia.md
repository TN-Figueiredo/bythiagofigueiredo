# Acesso direto pelo Claude Code ao Observatório (runbook)

Plano: `docs/superpowers/plans/2026-10-13-a5-e17-degrau-2-acesso-pelo-claude-code-plan.md`. **Estado: pronto e DESLIGADO.** Nenhuma chave existe, e o acesso só abre com as três travas (abaixo) e o "sim" do dono.

## Como fecho isso agora

1. Na Vercel, em Production, apague `OBSERVATORIO_IA_EXTERNA` (ou troque para qualquer valor que não seja `on`) e faça **redeploy**: toda chave do perfil passa a receber 503 `acesso externo desligado`.
2. Cortar uma pessoa só: revogue a chave dela (SQL "Revogar" abaixo). Depois rode a consulta "Ver as chaves do perfil".
3. Cortar sem revogar (três formas): (a) tirar o vínculo da pessoa com o site (a porta confere o vínculo a cada requisição e recusa 403); (b) banir a pessoa no Auth; (c) a pessoa pede a exclusão da conta (a porta recusa pelo pedido, mesmo antes do banimento).

## O que a ferramenta devolve

Um servidor MCP com UMA ferramenta, `observatorio_leitura`, só leitura. Nove ações: `definicoes`, `listar_canais` (até 200 canais), `canal`, `video`, `comparar` (2 a 6 canais), `destaques` (até 50 vídeos), `serie` (até 400 pontos; passa ao grão semana e diz), `mudancas` (até 100) e `pacote_da_tela` (até 30.000 caracteres; as outras, 60.000). Cada resposta traz os números, o estado "não medido" e o motivo. Nenhum recurso e nenhum prompt.

## As três travas (todas fechadas por padrão)

1. `OBSERVATORIO_IA_EXTERNA` com o valor exato `on` na Vercel (trava do dono). Conferir: Vercel, Settings, Environment Variables. Vale só depois de redeploy. **Fica ausente em Preview e em Development, sempre** (produção, prévia e a máquina local usam o mesmo banco).
2. A E19 publicada em modo `recusa` (trava de git: `lib/pipeline/leitura-modo.ts`). Conferir: `grep -n "modo:" apps/web/src/lib/pipeline/leitura-modo.ts`.
3. `e19RecusaConferidaEm` preenchida em `apps/web/src/lib/youtube/observatorio/acesso-ia/regras.ts` (a conferência do dia da promoção da E19 está no ledger dela).

A E19 voltou ao aviso com o acesso aberto? O acesso fecha sozinho (503). Antes de a recusa ser republicada, o controlador anula `e19RecusaConferidaEm` num commit e só a preenche de novo depois da conferência nova.

## Como o dono cria a chave

Antes de rodar: `git status` limpo, em `main`, igual a `origin/main` (o comando lê as duas guardas do seu checkout: a E19 conferida e a exceção da pergunta 47).

```
npx tsx --tsconfig apps/web/tsconfig.json --env-file apps/web/.env.local apps/web/scripts/observatorio-acesso.ts criar --usuario <e-mail da pessoa>
```

O comando só aceita `criar` e as opções `--usuario`, `--dias` (1 a 366; padrão 180) e `--site`. Ele **só insere**, e recusa: subcomando que não seja `criar`; opção desconhecida (nunca ignorada em silêncio); a E19 não conferida; a exceção do dono ausente; e-mail que não existe ou repetido; pessoa que não vê o site (ou vê dois e `--site` não veio); nome repetido; pessoa que já tem chave ativa (a segunda é aceita a partir de 14 dias antes do vencimento: renovar sem buraco); terceira pessoa com chave ativa (o teto é de duas PESSOAS); validade fora de 1 a 366 dias. O texto da chave aparece **uma vez**; só o SHA-256 vai ao banco. O nome é sempre o gerado (`observatorio-AAAAMMDD-xxxx`), sem dado pessoal.

A linha de uma chave vencida fica no banco, de propósito: o registro aponta para ela, e nada no sistema apaga nem revoga chave. Decidiu deixar a chave vencer? Marque a conferência de vencimento como feita mesmo assim, senão o cron fica vermelho 7 dias depois.

## Revogar uma chave do perfil (roda o dono, como `postgres`)

Uma instrução só, sem transação (no editor do painel cada execução é um pedido separado):

```sql
update public.pipeline_api_keys k set revoked_at = now()
where k.name = '<nome exato da chave>'
  and k.permissions = array['observatorio_leitura']::text[]
  and k.revoked_at is null
  and (select count(*) from public.pipeline_api_keys d
       where d.name = k.name and d.permissions = array['observatorio_leitura']::text[] and d.revoked_at is null) = 1
returning k.id, k.name, k.revoked_at;
```

Uma linha devolvida: revogada. Nenhuma linha: **nada mudou** (nome errado, chave já revogada, ou mais de uma chave com esse nome: nesse caso chame o controlador). Com o nome de `cowork-permanent`, `forja (fila)` ou `forja (so leitura)`, nenhuma linha vem.

**Obrigatório: rode em seguida a consulta de ver as chaves: a linha tem de aparecer com `revoked_at` preenchida.** Se não aparecer assim, a chave NÃO foi revogada.

## Consultas (só leitura)

Ver as chaves do perfil, sem o hash. O último uso de uma chave é `max(at)` do registro, não `last_used_at`:

```sql
select k.name, u.email, k.expires_at, k.revoked_at, k.created_at, (select max(l.at) from public.obs_ai_access_log l where l.key_id = k.id) as ultimo_uso from public.pipeline_api_keys k left join auth.users u on u.id = k.user_id where 'observatorio_leitura' = any (k.permissions) order by k.created_at;
```

Quem consultou o quê, nos últimos 7 dias. **`result = 'ok'` não quer dizer entregue:** entregue é `result = 'ok'` e `desfecho = 'ok'`; `falhou`, `tempo`, `pedido_invalido` e `nao_encontrado` também saem com `result = 'ok'`:

```sql
select l.at, u.email, l.action, l.result, l.params->>'desfecho' as desfecho, l.included_private, l.output_chars from public.obs_ai_access_log l left join auth.users u on u.id = l.user_id where l.origin = 'mcp' and l.at > now() - interval '7 days' order by l.at desc limit 200;
```

## O que o registro guarda e o que não guarda

Guarda: quem (pessoa e chave), quando, a ação, os parâmetros de uma lista fechada (ids, janela, formato, datas), o desfecho, se incluiu dado privado e quantos caracteres saíram. **Não guarda:** a pergunta feita à IA, a resposta da IA, a conversa, nem o texto devolvido. Uma linha é gravada ANTES de qualquer dado sair ("sem linha, sem dado"): se o registro falha, a pessoa recebe erro e nenhum dado.

Taxa: 30 por minuto e 500 por dia, por chave. A 31ª chamada do minuto recebe a hora de volta (horário de São Paulo). Cada chamada recusada por limite também soma no contador. Os números não sobem sozinhos.

Riscos em palavras simples: (31) quem tem a chave e o direito lê o desempenho privado do canal; por isso a chave é por pessoa, vence em 180 dias e se revoga com uma instrução; (38) o texto devolvido vai para o modelo de IA da pessoa e sai do nosso controle; a ferramenta nunca devolve texto de comentário a quem não tem o direito privado.

Pedido de apagamento de quem tem chave: a porta já recusa pelo pedido e pelo banimento; a chave continua na tabela até você revogar (SQL acima).

## Os dois servidores no Claude Code

**No Claude Code só o `observatorio` é instalado**, uma chave por pessoa (hoje duas previstas: a do dono e a da irmã). A mesma URL serve dois servidores e quem escolhe é a chave: `pipeline` (a chave permanente do Cowork) e `observatorio` (a chave da pessoa). O que esta seção diz do `pipeline` descreve o caminho do Cowork.

Decisão do dono: **o `pipeline` NÃO é instalado no Claude Code.** A chave permanente compartilhada não vai para o Claude Code; cada pessoa usa a sua chave do `observatorio`, e o uso de cada chave fica registrado em `obs_ai_access_log` com `key_id` e `user_id` (é por aí que se sabe quem leu o quê). Os motivos: o servidor `pipeline` escreve em produção (`publish_item`, `delete_item`, playlists) e pela ferramenta MCP não deixa rastro de quem chamou; a chave é a do Cowork, e uma escrita vinda do Claude Code não se distingue de uma do dono; leitura e escrita moram na mesma ferramenta, separadas pelo campo `action`, então regra de permissão por nome de ferramenta não separa as duas; a chave ficaria em texto puro no arquivo de configuração do Claude Code; e `$PIPELINE_COWORK_KEY` não existe no terminal (mora em `apps/web/.env.local`).

Instalação na máquina da pessoa (por usuário; **a chave nunca vai a arquivo do repositório**):

```
claude mcp add --scope user --transport http observatorio https://bythiagofigueiredo.com/api/mcp --header "Authorization: Bearer <a chave dela>"
```

Dentro do Claude Code, `/mcp` tem de mostrar `observatorio` conectado, com uma ferramenta só, `observatorio_leitura`. A regra de permissão que libera `observatorio_leitura` na configuração do **usuário** tem o nome exato lido no `/mcp` no dia; **não foi conferido** como o modo automático e os subagentes tratam ferramenta MCP.

Regra de uso: número de concorrente: qualquer um dos dois caminhos; o dado privado novo do seu canal e o texto de comentário: só `observatorio`; o desempenho antigo do seu canal, escrita e forja: pelo Cowork.

O que difere de propósito, para ninguém tomar por defeito: limites (a rota `changes` do Cowork dá 25, a ferramenta 50, no máximo 100; `channels` sem página contra 200 em `listar_canais`); `listar_canais` traz o canal próprio e `channels` não; o `pipeline` calcula na hora e carimba `medidas_meta.calculado_em`, o `observatorio` pode estar até 15 minutos atrás (cache das telas) e carimba "Gerado em" e "Dado mais recente"; o `pipeline` entrega instantes em UTC, o `observatorio` escreve `dd/mm` em São Paulo, com semana de segunda a domingo; o `pipeline` corta por tempo, o `observatorio` por tamanho, e os dois dizem; `destaques` traz também os vídeos de base fraca, marcados, em ordem de fase, e `outliers` os exclui e ordena por múltiplo. Defasagem: as cinco medidas chegam ao `pipeline` no Lote 2 da E7 e só chegam ao `observatorio` depois das telas (E5a) e do degrau 1. Taxa: 30 por minuto e 500 por dia no `observatorio` (abrir `canal` e `serie` para 15 canais são 30 chamadas; mais uma comparação chega a 31 no mesmo minuto), contra 100 por minuto em memória no `pipeline`. Nada aqui iguala proteção para o lado mais aberto.

## O que o Cowork tem de equivalente

| Ação daqui | O que o Cowork tem | Paridade |
|---|---|---|
| `listar_canais` | `GET /api/pipeline/youtube/competitors/channels` | diferente na forma, igual na conta; só provado pelo teste de paridade; esta ação traz o canal próprio e a rota não |
| `mudancas` | `GET …/competitors/changes` (`campos=todos`) | diferente: o texto de antes e depois da descrição do vídeo só sai por aqui; a lista de mudanças de campo do site só sai pelo Cowork, com `campos=todos` |
| `destaques` | `GET …/competitors/outliers` | diferente por padrão: a rota responde todas as idades, 25 vídeos; aqui vale o recorte da tela e 50 vídeos |
| `canal`, `video` (concorrente) | parte do que `channels` devolve | parcial |
| `comparar`, `video`, `serie`, `pacote_da_tela` | não há | só aqui |
| `canal`, `video`, `serie` e `pacote_da_tela` do canal próprio | há, por rotas antigas, de outra fonte: **os números não são comparáveis.** As seis rotas: `youtube/videos/:id`, `analytics/overview`, `analytics/grades`, `analytics/demographics`, `analytics/search-terms` e `ab-tests/:id/funnel` | as tabelas novas (`yt_own_*`) e o texto de comentário: só aqui, de propósito; o desempenho antigo: só pelo pipeline |
| `definicoes` | o documento vivo do Cowork | duas fontes, a caminho de uma |
| (não há) | `GET …/competitors/insights` | só no Cowork; aqui, `pacote_da_tela` com a tela `insights` (e a rota devolve `-1` e `0` onde a tela diz "não medido") |
| (não há) | ferramentas de escrita e forja | só no Cowork, de propósito |
