# T6b — portão de precisão do lugar (28/10) — REPROVADO

Amostra: amostra-lugar-2026-10-28.csv (96 outliers + 20 negativos; 122 chaves `pais:`). Rótulo do controlador na coluna chaves_corretas (só pelo título; tags/descrição não vistas).

- Estrito: 73/122 = **0,598** (Wilson 95%: 0,51–0,68).
- Leniente (aceita os países de listas "5 países…" e Israel/Palestina juntos): 94/122 = **0,77** (0,69–0,84).
- Negativos: 20/20 sem chave (ok).

## Padrão dos erros
1. **Tag/descrição padrão do canal**: canais do Vietnã emitem também `pais:TH` (e às vezes PH) em quase todo vídeo (linhas 10, 17, 18, 23, 29, 40, 41, 51, 63, 30, 36). Mesmo mecanismo da coordenada padrão (§T2 item 3), mas no texto.
2. Menções de passagem: BR em vídeo do Vietnã (8, 66), AO (11), JP em "Japão em São Paulo" (22), RU em "36 milhas da Rússia" (45), UA (67), KR (46), VN em vídeo da Índia (79), MG/IS (42).
3. Recall (não entra no portão): bandeira emoji ignorada (🇵🇪 60, 🇮🇹 47, 🇨🇳 70), lugares fora da semente (Chengdu, Ubud, Jomtien, Malta, João Pessoa).

## Conserto proposto (semente/regra v2)
- (a) Chave vinda só de tag/descrição que aparece em ≥ 50% dos vídeos recentes do mesmo canal = padrão do canal: não conta sozinha (igual à coordenada).
- (b) Prioridade do título: se o título tem chave, tags/descrição só acrescentam chave quando também aparecem no início da descrição (1ª linha) — ou não acrescentam.
- (c) Bandeira emoji 🇽🇽 → `pais:XX` (determinístico, ISO2 a partir dos indicadores regionais).
- (d) Semente: Chengdu, Ubud, Jomtien, Malta, João Pessoa (+ revisão das capitais).
Depois: dono roda a amostra de novo (semente fixa) → rótulo → portão.
