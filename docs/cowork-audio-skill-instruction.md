# Instrução para Skill de Produção — Audio Library Integration

> **Copie e adicione ao skill de produção do Cowork.** Esta instrução ensina o Cowork a usar a Audio Library para recomendar áudios durante pós-produção.

---

## Regra fundamental: SEMPRE buscar referência online

**NUNCA use conhecimento estático sobre a Audio Library.** Antes de qualquer operação com áudio, faça GET na referência atualizada:

```
GET /api/pipeline/context/cowork-section-schemas
Header: X-Pipeline-Key: $KEY
```

A seção "Audio Library" nessa referência contém:
- Todos os endpoints disponíveis (resolve, list, create, import, stats, export)
- Schema completo de cada request/response
- Algoritmo de scoring com pesos e thresholds
- Query params e filtros
- Exemplos com curl

**Se a referência mudou desde a última vez que você consultou, adapte seu comportamento.** A API pode ter novos campos, novos endpoints ou regras atualizadas. A referência online é a fonte de verdade.

---

## Quando usar a Audio Library

### Durante pós-produção (seção `postprod`)

Sempre que o roteiro ou o contexto do conteúdo pedir música de fundo, SFX, transição, intro ou outro:

1. **Busque a referência online** (`GET /api/pipeline/context/cowork-section-schemas`) para ter a API atualizada
2. **Consulte o resolver** (`POST /api/pipeline/audio-library/resolve`) com query montada a partir do contexto
3. **Interprete `resolve_status`** para decidir o que recomendar:
   - `LOCAL` → recomendar diretamente (pronto para uso)
   - `PENDING_MATCH` → recomendar com aviso de download necessário
   - `PARTIAL_MATCH` → sugerir como alternativa, explicar o que bateu e o que não
   - `NO_MATCH` → informar que não há match, sugerir buscar novo áudio
4. **Inclua recomendações na seção `postprod`** com score, breakdown e justificativa
5. **Verifique uso histórico** (`GET /api/pipeline/audio-library/:id`) para evitar repetir o mesmo áudio em conteúdos consecutivos

### Montando a query do resolve

Derive os parâmetros do contexto do conteúdo:
- `type`: `"music"` ou `"sfx"` conforme necessidade
- `energy`: baseado no tom (tutorial → 2-3, review → 3-4, storytelling → 4-5)
- `mood`: extraído do roteiro (motivational, calm, dramatic, etc.)
- `tags`: derivados do tema (tech, gaming, AI, lifestyle, etc.)
- `bpm_range`: baseado no ritmo do vídeo
- `reuse_scenarios`: mapeados para o tipo de uso (intro, background, highlight, review, outro)
- `description`: texto livre descrevendo o contexto

### Formatando recomendações no postprod

```markdown
## Áudio Recomendado

### Música de Fundo
- **Epic Rise.mp3** — Score: 18/36 (LOCAL)
  Cinematic, energy 4, 120 BPM. Tags: epic, motivational.
  Usado anteriormente em: EP035, EP038 (intro)

### SFX
- **Whoosh Clean.wav** — Score: 12/36 (LOCAL)
  Transition SFX, energy 3.

### Pendentes de Download
- **Calm Waters.mp3** — Score: 14/36 (PENDING)
  Ambient, energy 2, 80 BPM. Bom para background.
```

Sempre mostrar breakdown do score para justificar a escolha.

### Consultando stats para contexto

```
GET /api/pipeline/audio-library/stats
```

Use `needs_download` para alertar sobre áudios pendentes. Use `unused` para diversificar sugerindo áudios nunca utilizados.

---

## Regras

- **Não inventar nomes de arquivo.** Só recomendar áudios retornados pelo resolver.
- **Não ignorar status.** `pending` = precisa download. `retired` = descartado.
- **Não recomendar sem consultar.** Sempre chamar `/resolve` — nunca sugerir de memória.
- **Não criar assets.** Criação é feita via import ou UI. O Cowork consulta e recomenda.
- **Sempre buscar a referência atualizada** antes de usar qualquer endpoint da Audio Library.

---

## Importação de novos áudios

Quando o criador pedir para catalogar áudios novos (Artlist, etc.):

1. Buscar referência online para schema de import atualizado
2. `POST /api/pipeline/audio-library/import` com `dry_run: true` para preview
3. Confirmar com `dry_run: false`
4. Preencher tags, mood, energy e reuse_scenarios baseado no contexto
