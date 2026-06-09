// Editor data adapter — maps the live VideoData (ideia/roteiro per lang + scalar
// metadata) into the design-handoff `Version` shape so the stage components can be
// near-verbatim ports of `design_handoff_video_module/views-video.jsx`.
//
// Handoff `Version` fields (views-video.jsx blankVersion / VideoCard / stages):
//   { title, direction, siblings, logline, pillar, angles, framework,
//     duration, location, recorded, beats, ab? }
//
// `cur = versions[activeLang]`. Title/direction/siblings/logline/angles/framework
// come from the per-lang ideia payload; beats from the per-lang roteiro; pillar +
// duration are item-level scalars; location/recorded/ab are not yet persisted so
// they default empty (the rebuild agent fills them from metadata when available).

import type { PillarId } from '@/lib/pipeline/pillars'
import type { RoteiroBeatV3, RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'
import type { ABDraft } from '@/lib/pipeline/video-schemas'
import type { IdeiaPayload } from './data-context'
import type { VideoLang } from './types'

/** One language version of a video, in the design-handoff shape. */
export interface Version {
  title: string
  direction: string
  siblings: string[]
  logline: string
  pillar: PillarId | undefined
  angles: string
  framework: string
  duration: string
  location: string
  recorded: string
  beats: RoteiroBeatV3[]
  ab?: ABDraft
}

/** Both language versions keyed by lang — `versions` in the handoff. */
export type EditorModel = Record<VideoLang, Version>

/**
 * Unstarted Publicação: a fresh 4-way contest — all four variants are challengers (no incumbent).
 * `firstOnAir:'A'` is only the start-time pick of which thumbnail goes live first on YouTube.
 */
export const EMPTY_AB_DRAFT: ABDraft = {
  firstOnAir: 'A',
  variants: [
    { id: 'A', role: 'challenger', title: '', brief: '' },
    { id: 'B', role: 'challenger', title: '', brief: '' },
    { id: 'C', role: 'challenger', title: '', brief: '' },
    { id: 'D', role: 'challenger', title: '', brief: '' },
  ],
}

export interface ToEditorModelInput {
  ideia: { pt: IdeiaPayload; en: IdeiaPayload }
  roteiro: { pt: RoteiroContentV3 | null; en: RoteiroContentV3 | null }
  pillar: PillarId | undefined
  durationRange: string | undefined
}

function versionFor(
  ideia: IdeiaPayload,
  roteiro: RoteiroContentV3 | null,
  pillar: PillarId | undefined,
  durationRange: string | undefined,
): Version {
  return {
    title: ideia.title ?? '',
    direction: ideia.direction ?? '',
    siblings: ideia.siblings ?? [],
    logline: ideia.logline ?? '',
    pillar,
    angles: ideia.angles ?? '',
    framework: ideia.framework ?? '',
    duration: durationRange ?? '',
    location: '',
    recorded: '—',
    beats: roteiro?.beats ?? [],
  }
}

/** Build the `{ pt, en }` editor model from the live VideoData scalars + sections. */
export function toEditorModel(input: ToEditorModelInput): EditorModel {
  return {
    pt: versionFor(input.ideia.pt, input.roteiro.pt, input.pillar, input.durationRange),
    en: versionFor(input.ideia.en, input.roteiro.en, input.pillar, input.durationRange),
  }
}

/** A version "exists" if it has any authored ideia content or a roteiro with beats. */
function versionPresent(v: Version): boolean {
  return (
    v.title.trim().length > 0 ||
    v.direction.trim().length > 0 ||
    v.beats.length > 0 ||
    v.logline.trim().length > 0
  )
}

/**
 * Which langs actually have a version. The `primary` lang is always present (it's the
 * one the editor opened on); the other only counts if it carries authored content.
 */
export function presentLangs(versions: EditorModel, primary: VideoLang): VideoLang[] {
  const other: VideoLang = primary === 'pt' ? 'en' : 'pt'
  const langs: VideoLang[] = [primary]
  if (versionPresent(versions[other])) langs.push(other)
  return langs.sort((a, b) => (a === 'pt' ? -1 : b === 'pt' ? 1 : 0))
}
