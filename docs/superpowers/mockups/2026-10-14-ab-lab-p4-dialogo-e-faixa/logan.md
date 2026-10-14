# Revisão de fluxo e texto (Logan): A/B Lab P4a e P4b, diálogo "O que fica no vídeo?" e faixa de restauração

Veredito do conjunto: **volta para ajuste** (nenhum bloqueio; 6 achados "corrige", 3 sugestões). Posição: **não de acordo** até os 6 "corrige" entrarem.
Verifiquei: abri o `index.html` em 390 px e 1440 px, nas duas versões (P4a/P4b): rolagem horizontal da página = 0 nas quatro. Capturas em `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9530e70e-0c5a-48e6-8c6e-6a72b19b746d/scratchpad/ls-{m,d}-{a,b}.png` (página inteira; em 390 px ficam pequenas demais para ler texto, então o texto eu conferi no HTML). Não verifiquei: leitor de tela, rede lenta, aparelho real.

## Pergunta e passos
Pergunta de quem abre: "Qual título e thumbnail ficam no meu vídeo, e deu certo?"
Tarefa principal: abrir o diálogo (1), marcar a opção (2), "Encerrar e ficar com B" (3) = **3 passos**. Com edição externa: 4 (Voltar ou "Trocar... e encerrar"). Não há passo sobrando. O botão que nomeia a escolha e a ausência da linha "mais views/dia" estão certos; preservar.
Para falha: ler a faixa e agir = 1 passo (P4b) ou 1 passo + ir ao YouTube Studio (P4a).

## Julgamento das cinco decisões
1. "Este aviso fica até a próxima versão do A/B Lab": **trocar**. Responde à pergunta real do dono (isto some?), mas "próxima versão" é jargão de quem desenvolve e promete o que o dono não controla. Texto: **"Este aviso ainda não pode ser dispensado."** (em C e em E, só P4a).
2. Hora na nova tentativa: **aceito o conceito, o horário do mockup está errado** (achado 1).
3. `precisa_confirmar` com título próprio: **aceito** ("Trocar mesmo assim?" é a pergunta exata da B3; foco em "Voltar"; alertdialog). Ajustes no achado 5.
4. Sem "mais views/dia": **de acordo** (emenda 40; a linha é da etapa de telas).
5. "Encerrando…" com "Não feche esta janela" e Fechar desabilitado: **rejeito como está** (achado 2).

## Achados

### 1. Horário da nova tentativa está errado nas telas C, D, H, I (P4b) — corrige
- **Falha:** falha às 05:02 diz "próxima verificação, às 17:00 (tentativa 2 de 3)". O `apps/web/vercel.json` roda `ab-watchdog` às `0 10` e `0 20` UTC = **07:00 e 17:00 de São Paulo** (sem horário de verão). Depois de 05:02 a próxima é **07:00**, não 17:00. Em H, "última recusa 13/10 17:00" também não fecha: 05:02 (1), 07:00 (2), 17:00 (3) vira `desistiu` em 12/10 às 17:00, não no dia 13 (spec 3.5: a falha original grava 1; só o vigia incrementa; cota não conta).
- **Por quê:** o dono espera a hora escrita; um aviso de 07:00 que diz 17:00 faz ele agir à mão por nada, ou esperar dez horas com o título errado no ar. O dono viaja (Ásia em jan/2027): hora sem fuso é ambígua.
- **Custo:** decisão errada sobre esperar ou agir.
- **Solução:** a hora sai do servidor, do próximo horário fixo (07:00 ou 17:00 de São Paulo) e leva o fuso: **"Nova tentativa automática por volta das 07:00 (horário de São Paulo), tentativa 2 de 3."** Se o vigia estiver atrasado (cron-health stale), omitir hora e dizer só "na próxima verificação". Corrigir D e I igual ("por volta das 07:00 (horário de São Paulo), sem perguntar de novo..."). Em H: "Última recusa do YouTube em 12/10 17:00." Padronizar fuso em toda data da faixa: acrescentar "(horário de São Paulo)" uma vez no cabeçalho da faixa ("12/10 05:02" hoje não diz de onde).

### 2. "Encerrando…": "Não feche esta janela" e Fechar desabilitado prendem a pessoa — corrige
- **Falha:** a frase não é verdade e o controle não tem saída. A escrita roda no servidor; fechar a janela não a cancela. Em conexão ruim (cenário real do dono) a resposta pode nunca chegar e a janela fica travada sem Fechar, Cancelar nem Esc.
- **Custo:** dono recarrega à força sem saber se o título foi trocado; ou repete o "Encerrar" (cai em `em_andamento`).
- **Solução:** manter só "Cancelar" desabilitado (não existe desfazer) e deixar o ✕ ativo. Texto do aviso: **"Trocando título e thumbnail no YouTube. Pode levar até 1 minuto. Se fechar, o resultado aparece no topo da página."** Se passar de 45 s ou a conexão cair: estado novo, com `role="alert"`: **"Sem resposta. Não sabemos se o encerramento foi feito. Recarregue a página para ver o resultado."** com botões "Recarregar" e "Fechar". Esc fecha igual ao ✕. Se o desenhista mantiver a trava, ela só pode valer até esses 45 s.

### 3. Falta a passagem do diálogo para a faixa quando o YouTube recusa — corrige
- **Falha:** a tela 3 ("Erro do servidor") só mostra `em_andamento`. Quando a troca falha, o teste já saiu do ar no Lab (emenda 32b) e a verdade é a faixa `falhou`. Se o erro ficar no diálogo, o dono clica "Encerrar" de novo num teste já encerrado.
- **Solução:** resposta `falhou` ou `pulado_*` fecha o diálogo, foca a faixa e mostra aviso de página (`role="alert"`, 6 s, com fechar): **"Teste encerrado. O YouTube recusou a troca do título: veja o aviso no topo."** O erro dentro do diálogo fica só para o que não encerrou (`em_andamento`, falha de rede, sem permissão). Acrescentar uma figura "diálogo fechando → faixa".

### 4. "Em andamento" (faixa A) não tem origem no contrato de dados — corrige
- **Falha:** `restore_status.estado` (spec 3.5) é `ok`, `falhou`, `pulado_sem_original`, `pulado_drift`, `desistiu`. Não existe "em andamento", e a faixa A mostra "Trocando desde 12/10 05:00", data que só existiria se o estado fosse gravado. Sem estado gravado, ao fechar e reabrir a página a faixa some e a tela parece "nada aconteceu".
- **Solução:** ou (a) A vira estado só do navegador, enquanto o diálogo ou a página que o disparou estiver aberta, **sem data**: "Voltando ao original. Título e thumbnail estão sendo trocados no YouTube."; ou (b) pedir à Yannis/Phil o estado `em_andamento` com `em`. Recomendo (a) para a P4a. O texto fixo "Voltando ao original" também erra quando o destino é variante: **"Aplicando a variante B."** conforme `destino`.

### 5. Detalhes do `precisa_confirmar` — corrige
- **"a edição se perde":** só afirmar se for verdade. Se o título editado não fica guardado em lugar nenhum, o texto certo é **"O título abaixo, no YouTube agora, será substituído pelo da variante B. A edição não fica guardada aqui: copie-o antes se quiser mantê-la."** Pendente de Phil: se as versões do vídeo (E18) guardam o título atual, trocar por "...fica no histórico do vídeo". Não deixar "se perde" sem conferir.
- **Os dois campos editados por fora:** só existem diálogos de um campo (título OU thumbnail). Faltou o caso dos dois: um corpo com as duas comparações e o botão **"Trocar título e thumbnail por B e encerrar"**; um confirma, não dois diálogos em sequência.
- **Voltar:** devolve ao diálogo de escolha com a opção B ainda marcada (dizer isso na especificação).
- **Cor do botão** (âmbar ou vermelho): é da Naksu; o texto está certo.

### 6. Texto da faixa D afirma o que o dado não sustenta — corrige
- **Falha:** "No ar continua o título editado por fora" só é verdade quando houve confirmação de edição externa (`forcado = true`). Se a falha ocorreu sem edição externa, o que continua no ar é o da variante C (ou a que estava).
- **Solução:** dois textos por `forcado`. `forcado = true`: "o título da variante B não foi aplicado. No ar continua o título editado por fora." `forcado = false`: "o título da variante B não foi aplicado. No ar continua o da variante C." Mesma regra para a thumbnail.

### 7. `role="alert"` em faixa que já estava na página — sugestão
Faixa fixa lida como `alert` a cada visita ao teste repete o erro a quem usa leitor de tela. Usar `alert` só quando a faixa aparece depois de uma ação na mesma sessão; ao carregar a página, `region` rotulada ("Restauração do vídeo"). As faixas E, F e G (atenção) como `status` ficam.

### 8. Pergunta que a faixa deixa sem resposta em `ok` — sugestão
A linha "Título e thumbnail voltaram ao original em 12/10 05:02" é boa. Em encerramento com variante (destino B) usar a espelhada: **"Variante B no ar desde 12/10 05:02."**, para o dono ler em 3 s que o caminho feliz também deu certo.

### 9. Sem permissão (tela 6) — sugestão
A única opção já vem marcada e o botão ligado: aceitável (opção única, e o botão nomeia "A (original)"). Manter, mas dizer no texto que há só uma opção: "Você pode voltar ao original." já cobre.

## Notas para a Naksu
Cor do botão de confirmar em `precisa_confirmar`; foco visível do "Voltar" (hoje com `outline` inline); alvos de 44 px em 390 px nos botões `sm` da faixa; capturas de 390 px a conferir com zoom.

## Resumo
Telas: 2 conjuntos (diálogo, faixa), ambos **volta para ajuste**. Fricções que mais custam: (1) horário errado da nova tentativa; (2) janela que prende na conexão ruim; (3) falta de passagem diálogo→faixa quando o YouTube recusa.

---

## Rodada 2

Verifiquei: abri o `index.html` em 390 px e 1440 px, P4a e P4b, tema escuro (rolagem horizontal da página = 0 nas quatro; nenhum botão com altura abaixo de 44 px; marcar B no diálogo 1 troca o botão para "Encerrar e ficar com B"). Texto conferido no HTML e capturas em `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/9530e70e-0c5a-48e6-8c6e-6a72b19b746d/scratchpad/r2-{390,1440}-{a,b}.png`. Não verifiquei: leitor de tela, rede lenta, aparelho real, tema claro por mim (as capturas claras do controlador em `shots/v2/` não li).

### Veredito por achado da rodada 1
1. Horário da nova tentativa: **fechado.** C, D, D2 e 3b dizem "por volta das 07:00 (horário de São Paulo), tentativa 2 de 3"; H usa 17:00 de 12/10 com a sequência 05:02, 07:00, 17:00; cabeçalho da faixa traz "Horários de São Paulo".
2. "Encerrando…": **fechado.** ✕ e Esc livres, só "Cancelar" desabilitado, texto "Pode levar até 1 minuto. Se fechar, o resultado aparece no topo da página."; tela 2b "Sem resposta" com `alert`, "Recarregar" e "Fechar". 45 s < 1 min, coerente.
3. Passagem diálogo para faixa: **fechado** (figura 3b), com dois resíduos novos abaixo (N2, N3).
4. "Em andamento": **fechado pela decisão do controlador** (`em_andamento` por campo, com `em` e `destino`; A1 "Voltando ao original", A2 "Trocando pela variante B"). Cria o problema N1.
5. `precisa_confirmar`: **fechado.** "sai do YouTube" no lugar de "se perde"; caso dos dois campos (5b) com um só botão; "Voltar" devolve à escolha com B marcada (dito na legenda).
6. Texto da faixa D: **fechado.** D (`forcado = true`) e D2 (`forcado = false`) dizem o que está no ar conforme o dado.
7. `alert` x `region`: **fechado.** Faixas carregadas com a página são `region`; só a de 3b (após ação) é `alert`; E, F, G `status`.
8. Espelho em `ok`: **fechado** ("Variante B no ar desde 12/10 05:02.").
9. Sem permissão (tela 6): **mantido como estava**, aceito.
Decisão 1 da rodada 1 ("Este aviso ainda não pode ser dispensado"): aplicada em C, D, D2, E, F, G, P4a.

### Achados novos

**N1. `em_andamento` sem fim (A1, A2): corrige.**
- Falha: se o servidor cair no meio da escrita, o campo fica `em_andamento` para sempre e a faixa gira "Trocando desde 12/10 05:00" eternamente. Na P4a não há vigia para limpar; o dono vê um giro que não termina e não sabe se o título foi trocado.
- Custo: o dono espera ou age às cegas sobre um título que pode estar certo ou errado.
- Solução: `em_andamento` com `em` mais velho que 5 minutos vira a linha, sem ícone de giro (ícone `none`, cor de atenção): **"Sem resposta desde 12/10 05:00. Não sabemos se a troca foi feita. Confira o título no YouTube Studio."** com "Abrir no YouTube Studio". O resumo da faixa passa a **"Não sabemos se voltou ao original."** (ou **"...se a variante B foi aplicada."**). Na P4b o vigia já pode converter em falha. O limite de 5 min vai a Phil/Yannis confirmar contra o tempo máximo da escrita.

**N2. Aviso de página de 3b tem "título" fixo: corrige.**
- Falha: "O YouTube recusou a troca do título" é escrito para um só caso; se a recusa for da thumbnail ou dos dois, o aviso afirma o campo errado.
- Solução, por campo recusado: **"Teste encerrado. O YouTube recusou a troca do título: veja o aviso no topo."** / **"...da thumbnail: ..."** / **"...do título e da thumbnail: ..."**.

**N3. Aviso de 3b e faixa, ambos `alert`: sugestão.** Leitor de tela lê o erro duas vezes. Deixar o aviso de página como `status` e só a faixa como `alert`, com o foco já nela.

**N4. Tela I sem contagem: sugestão.** Acrescentar "tentativa 2 de 3" como nas telas C e D, para a pessoa sem permissão ver o mesmo estado que o administrador.

### Para a Naksu
Nada novo. Duplo `alert` (N3) é decisão conjunta.

### Resumo da rodada
Os 6 "corrige" e as 3 sugestões da rodada 1 estão fechados e nenhum conserto piorou fluxo. Restam N1 e N2 (texto, uma linha cada de mudança) como "corrige"; N3 e N4 são sugestões. Sem N1 e N2 a faixa afirma mais do que o dado sustenta.

**Posição: não de acordo**, até N1 e N2 entrarem; entrando, passo a "de acordo" sem nova rodada (conferência por busca de texto).
