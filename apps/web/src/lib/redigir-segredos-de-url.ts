/**
 * Redação de segredos que viajam em URL, query string e cabeçalhos (A5).
 *
 * Motivo: as chamadas à YouTube Data API levam a chave na query (`...&key=<CHAVE>`).
 * O SDK do Sentry 10.x manda a query das requisições de saída num campo SEPARADO da
 * URL (`http.query` em spans e breadcrumbs de fetch/http, `url.query` nos spans do
 * OpenTelemetry) e repete a URL inteira em `http.url`/`url.full`. Redigir só
 * `data.url` não alcança a query.
 *
 * Módulo-folha: NENHUM import e nenhum acesso ao ambiente de execução. Tudo é puro,
 * síncrono e NUNCA lança (um erro dentro de um gancho do Sentry não pode derrubar o
 * envio do evento nem a requisição do usuário).
 *
 * A redação é dirigida por NOME de parâmetro/campo, como em `redact-secrets.ts`, e o
 * resto da URL fica legível (o `id=`, o caminho): ela continua útil para depurar.
 * O marcador é o mesmo do projeto: `[REDACTED]`.
 */

const MARCA = '[REDACTED]'
const LIMITE_PROFUNDIDADE = 12
const MARCA_PROFUNDA = '[profundo demais]'

/** Nomes de parâmetro de query/fragmento que carregam segredo. */
const NOMES_PARAM =
  'key|api[_-]?key|access_token|id_token|refresh_token|token|x-pipeline-key|x-api-key|x-goog-api-key'

/** `?key=…`, `&key=…`, `&amp;key=…`, `#access_token=…`, `KEY=…` e a forma nua em início/espaço. */
const PARAM_RE = new RegExp(
  `(^|[?&;#\\s"'(,])((?:${NOMES_PARAM})=)[^&\\s"'#]+`,
  'gi',
)

/** Mesma coisa dentro de uma URL aninhada e codificada (`%3Fkey%3D…%26id%3D…`). */
const PARAM_CODIFICADO_RE = new RegExp(
  `(%3F|%26|%23)((?:${NOMES_PARAM})%3D)(?:(?!%26)[^&\\s"'])+`,
  'gi',
)

/** Cabeçalho/atribuição ecoado em texto: `x-pipeline-key: …`, `Authorization: Bearer …`, `"api_key":"…"`. */
const ATRIBUICAO_RE =
  /("?(?:x-pipeline-key|x-api-key|x-goog-api-key|proxy-authorization|authorization|api[_-]?key)"?\s*[:=]\s*"?(?:(?:Bearer|Basic)\s+)?)([^"'&\s,}]+)/gi

/** 2ª rede: o formato de uma chave de API do Google, em qualquer posição. */
const CHAVE_GOOGLE_RE = /AIza[0-9A-Za-z_-]{35}/g

/** Nomes de campo (cabeçalho, extra, tag, dado de span) cujo valor string é sempre segredo. */
const CAMPOS_SENSIVEIS = new Set([
  'authorization',
  'proxy-authorization',
  'x-pipeline-key',
  'x-api-key',
  'x-goog-api-key',
  'api_key',
  'api-key',
  'apikey',
  'access_token',
  'id_token',
  'refresh_token',
  'token',
  'client_secret',
])

const NOME_DE_PARAM_RE = new RegExp(`^(?:${NOMES_PARAM})$`, 'i')

/** Redige segredos de URL/query/cabeçalho numa string. Nunca lança; string sem segredo sai idêntica. */
export function redigirSegredosDeUrl(texto: string): string {
  if (typeof texto !== 'string' || texto.length === 0) return texto
  try {
    return texto
      .replace(PARAM_RE, `$1$2${MARCA}`)
      .replace(PARAM_CODIFICADO_RE, `$1$2${MARCA}`)
      .replace(ATRIBUICAO_RE, `$1${MARCA}`)
      .replace(CHAVE_GOOGLE_RE, MARCA)
  } catch {
    // Fail-closed: se a redação falhar, nada do texto original sobe.
    return MARCA
  }
}

function ehCampoSensivel(nome: string): boolean {
  return CAMPOS_SENSIVEIS.has(nome.toLowerCase())
}

function visitar(valor: unknown, nivel: number, vistos: WeakSet<object>): unknown {
  if (typeof valor === 'string') return redigirSegredosDeUrl(valor)
  if (valor === null || typeof valor !== 'object') return valor
  if (vistos.has(valor)) return valor
  vistos.add(valor)
  if (nivel >= LIMITE_PROFUNDIDADE) return MARCA_PROFUNDA

  if (valor instanceof Error) {
    try {
      valor.message = redigirSegredosDeUrl(valor.message)
      if (typeof valor.stack === 'string') valor.stack = redigirSegredosDeUrl(valor.stack)
    } catch {
      // propriedade somente leitura: segue para os campos próprios
    }
  }

  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) {
      try {
        const novo = visitar(valor[i], nivel + 1, vistos)
        if (novo !== valor[i]) valor[i] = novo
      } catch {
        // um elemento hostil não impede os demais
      }
    }
    return valor
  }

  const registro = valor as Record<string, unknown>
  let chaves: string[] = []
  try {
    chaves = Object.keys(registro)
  } catch {
    return valor
  }
  for (const k of chaves) {
    try {
      const atual = registro[k]
      const novo =
        typeof atual === 'string' && atual.length > 0 && ehCampoSensivel(k)
          ? MARCA
          : visitar(atual, nivel + 1, vistos)
      if (novo !== atual) registro[k] = novo
    } catch {
      // um campo hostil (getter que lança, somente leitura) não impede os demais
    }
  }
  return valor
}

/**
 * Percorre `valor` (objetos, arrays, `Error`) com limite de profundidade e proteção
 * contra referência circular, redigindo no lugar toda string e todo campo de nome
 * sensível. Devolve o valor (para strings, a string redigida). Nunca lança.
 */
export function redigirValorProfundo<T>(valor: T): T {
  try {
    // visitar devolve o mesmo tipo de entrada: string vira string, objeto continua o mesmo objeto.
    return visitar(valor, 0, new WeakSet<object>()) as T
  } catch {
    return valor
  }
}

/** Igual a `redigirValorProfundo`, para quem só quer o efeito no objeto. */
export function redigirSegredosEmProfundidade(valor: unknown): void {
  redigirValorProfundo(valor)
}

/**
 * `request.query_string` do Sentry pode ser string, objeto `{ nome: valor }` ou lista de
 * pares `[nome, valor]`. Aqui o NOME decide (`key` sozinho conta, porque é uma query).
 */
export function redigirQueryString(qs: unknown): unknown {
  try {
    if (typeof qs === 'string') return redigirSegredosDeUrl(qs)
    if (Array.isArray(qs)) {
      return qs.map((item: unknown) => {
        if (Array.isArray(item) && typeof item[0] === 'string' && NOME_DE_PARAM_RE.test(item[0])) {
          return [item[0], MARCA, ...item.slice(2)]
        }
        return redigirValorProfundo(item)
      })
    }
    if (qs !== null && typeof qs === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(qs as Record<string, unknown>)) {
        out[k] = NOME_DE_PARAM_RE.test(k) && typeof v === 'string' ? MARCA : redigirValorProfundo(v)
      }
      return out
    }
    return qs
  } catch {
    return MARCA
  }
}
