'use client'

import { CoworkTrigger } from '@/app/cms/(authed)/_shared/cowork/cowork-trigger'
import { useVideoEditorState } from '../context'
import type { VideoStage } from '../types'

/** Stage label for the instruction context handed to Cowork. */
const STAGE_LABEL: Record<VideoStage, string> = {
  ideia: 'Ideia', roteiro: 'Roteiro', pos: 'Pós', publicacao: 'Publicação',
}

/**
 * Per-stage target hint appended to the deep-link context so Cowork knows the exact
 * section + schema to write (and how to derive it). Optional per stage — a stage with
 * no hint keeps its prior freeform behavior.
 */
const STAGE_TARGET_HINT: Partial<Record<VideoStage, (itemId: string, lang: string) => string>> = {
  roteiro: (itemId, lang) =>
    `→ escreva a seção \`roteiro\` (RoteiroContentV3) via MCP manage_sections (action:update, item_id:${itemId}, section:roteiro, lang:${lang}); ` +
    `leia a ideia primeiro com manage_sections action:get (section:ideia, lang:${lang}); ` +
    `CADA beat DEVE incluir \`duration\` (int, segundos estimados de fala num ritmo natural ≈ 2.1 palavras/seg + pausas — some realista, NÃO chute zero); ` +
    `ao terminar, atualize \`format_metadata.duration_range\` via update_item (ex.: "8–12min") coerente com a soma dos durations dos beats — ` +
    `o hub e o print usam esses timers, roteiro sem duration aparece sem cronômetro.`,
  pos: (itemId, lang) =>
    `→ escreva a seção \`postprod\` (PosBriefSchema, kind:'brief') via MCP manage_sections (action:update, item_id:${itemId}, section:postprod, lang:${lang}); ` +
    `derive estilo & ritmo, CTAs e QR do roteiro — leia primeiro com manage_sections action:get (section:roteiro, lang:${lang}); ` +
    `o escopo de entrega (o que cortar/entregar) vai em deliverables.notes (texto livre), NÃO invente outros campos em deliverables; ` +
    `curadoria por beat (apertar a frase-âncora, corrigir um cue de b-roll) vai em \`overrides\` (record por id do beat, fallback i<index>: {line?, cue?, broll?}) — sombreia os Momentos/B-roll derivados, NUNCA reescreva o roteiro só pra ajustar o brief do editor; ` +
    `style[].k é um RÓTULO curto (1–3 palavras, ex. "Pacing", "Music") — qualquer detalhe/parêntese vai no style[].v, nunca na chave. ` +
    `IMPORTANTE — o editor de vídeo é estrangeiro (NÃO fala português): escreva TODAS as instruções pro editor EM INGLÊS, mesmo num vídeo PT-BR — ` +
    `style & ritmo (style[].v), energy, deliverables.notes/escopo e B-roll cues, tudo em inglês. ` +
    `A ÚNICA exceção é o texto literal de CTA que aparece NA TELA: ctas.rows[].pt = o que vai escrito na tela em português, .en = em inglês.`,
  publicacao: (itemId, lang) =>
    `→ escreva a seção \`publish\` (ABDraftSchema) via MCP manage_sections (action:update, item_id:${itemId}, section:publish, lang:${lang}); ` +
    `leia primeiro o roteiro e a ideia com manage_sections action:get, então gere EXATAMENTE 4 variantes testáveis A–D ({id, title, brief}), ` +
    `cada variante = um TÍTULO testável + um BRIEF DE THUMBNAIL (o conceito visual da capa: o que ela mostra/comunica), ` +
    `cada uma num ângulo distinto (emocional/dados/curiosidade/promessa) derivado do roteiro + ideia; ` +
    `só TEXTO (título + brief da capa), nunca URLs/imagens — a arte é feita no Claude Design; ` +
    `todas role:'challenger' (sem 'winner', sem 'original'); firstOnAir = a capa que entra primeiro no ar.`,
}

/** Context prompts per stage (CW_PROMPTS in views-video.jsx ~39-44). */
const CW_PROMPTS: Record<VideoStage, string[]> = {
  ideia: ['Gerar 3 novas direções', 'Qual é o gancho mais forte?', 'Sugerir ângulos (A1–A5)'],
  roteiro: ['Encurtar mantendo os beats', 'Reforçar o hook', 'Sugerir b-roll por beat', 'Marcar ênfases'],
  pos: ['Gerar instruções de edição', 'Que b-roll ainda falta?', 'Revisar CTAs/QR por idioma'],
  publicacao: ['Gerar 4 variações: título + thumbnail', 'Variar os ângulos de gancho', 'Sugerir distribuição'],
}

/** Per-stage textarea placeholder — phrased as if you're talking to a sharp collaborator. */
const CW_PLACEHOLDER: Record<VideoStage, string> = {
  ideia: 'ex.: e se o gancho fosse mais incômodo? me dá 3 caminhos…',
  roteiro: 'ex.: corta 15s no meio sem perder o beat do CTA…',
  pos: 'ex.: o ritmo tá arrastado depois do hook — sugere cortes…',
  publicacao: 'ex.: títulos menos óbvios, mais curiosidade que promessa…',
}

export interface CoworkButtonProps {
  stage: VideoStage
  label?: string
  compact?: boolean
}

/**
 * Video-editor Cowork trigger: builds the per-stage instruction context (item id,
 * stage, active language + section/schema hint) from the editor state and delegates
 * the popover/send UX to the shared `CoworkTrigger`.
 */
export function CoworkButton({ stage, label = 'Cowork', compact }: CoworkButtonProps) {
  const editor = useVideoEditorState()
  const lang = editor.activeLang
  const header =
    `[Vídeo ${editor.code} · ${STAGE_LABEL[stage]} · ${lang.toUpperCase()} · item_id ${editor.itemId}]\n` +
    `Trabalhe EXCLUSIVAMENTE neste item_id (${editor.itemId}). NÃO crie um novo item nem use outra "versão"/duplicata — ` +
    `se você tiver uma task antiga apontando pra outro id, ignore: a fonte da verdade é o item aberto agora no CMS.`
  return (
    <CoworkTrigger
      header={header}
      hint={STAGE_TARGET_HINT[stage]?.(editor.itemId, lang)}
      prompts={CW_PROMPTS[stage] ?? []}
      placeholder={CW_PLACEHOLDER[stage]}
      subline="ele escreve direto na pipeline — pede o ajuste e ele mexe na ideia, no roteiro, no pós e na publicação."
      label={label}
      compact={compact}
    />
  )
}
