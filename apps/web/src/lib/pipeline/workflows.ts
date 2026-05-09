import type { Format } from './schemas'

export interface WorkflowStage {
  stage: string
  position: number
  label_pt: string
  label_en: string
}

export const WORKFLOWS: Record<Format, WorkflowStage[]> = {
  video: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'roteiro', position: 2, label_pt: 'Roteiro', label_en: 'Script' },
    { stage: 'gravacao', position: 3, label_pt: 'Gravação', label_en: 'Recording' },
    { stage: 'edicao', position: 4, label_pt: 'Edição', label_en: 'Editing' },
    { stage: 'pos_producao', position: 5, label_pt: 'Pós-produção', label_en: 'Post-production' },
    { stage: 'scheduled', position: 6, label_pt: 'Agendado', label_en: 'Scheduled' },
    { stage: 'published', position: 7, label_pt: 'Publicado', label_en: 'Published' },
  ],
  blog_post: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'draft', position: 2, label_pt: 'Rascunho', label_en: 'Draft' },
    { stage: 'ready', position: 3, label_pt: 'Pronto', label_en: 'Ready' },
    { stage: 'scheduled', position: 4, label_pt: 'Agendado', label_en: 'Scheduled' },
    { stage: 'published', position: 5, label_pt: 'Publicado', label_en: 'Published' },
  ],
  newsletter: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'draft', position: 2, label_pt: 'Rascunho', label_en: 'Draft' },
    { stage: 'ready', position: 3, label_pt: 'Pronto', label_en: 'Ready' },
    { stage: 'scheduled', position: 4, label_pt: 'Agendado', label_en: 'Scheduled' },
    { stage: 'published', position: 5, label_pt: 'Publicado', label_en: 'Published' },
  ],
  course: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'outline', position: 2, label_pt: 'Outline', label_en: 'Outline' },
    { stage: 'modulos', position: 3, label_pt: 'Módulos', label_en: 'Modules' },
    { stage: 'review', position: 4, label_pt: 'Revisão', label_en: 'Review' },
    { stage: 'published', position: 5, label_pt: 'Publicado', label_en: 'Published' },
  ],
  campaign: [
    { stage: 'idea', position: 1, label_pt: 'Ideia', label_en: 'Idea' },
    { stage: 'draft', position: 2, label_pt: 'Rascunho', label_en: 'Draft' },
    { stage: 'approved', position: 3, label_pt: 'Aprovada', label_en: 'Approved' },
    { stage: 'scheduled', position: 4, label_pt: 'Agendada', label_en: 'Scheduled' },
    { stage: 'sent', position: 5, label_pt: 'Enviada', label_en: 'Sent' },
  ],
}

export interface ChecklistItem {
  label: string
  done: boolean
  toggled_at?: string
}

export const DEFAULT_CHECKLISTS: Record<Format, ChecklistItem[]> = {
  video: [
    { label: 'Roteiro finalizado', done: false },
    { label: 'Thumbnail conceituada', done: false },
    { label: 'B-roll listado', done: false },
    { label: 'Equipamento verificado', done: false },
    { label: 'Gravação concluída', done: false },
    { label: 'Edição concluída', done: false },
    { label: 'Título + descrição SEO', done: false },
    { label: 'Cards e end screen', done: false },
  ],
  blog_post: [
    { label: 'Outline aprovado', done: false },
    { label: 'Rascunho escrito', done: false },
    { label: 'Revisão gramatical', done: false },
    { label: 'Imagens/mídia inseridos', done: false },
    { label: 'SEO meta preenchido', done: false },
    { label: 'CTA definido', done: false },
  ],
  newsletter: [
    { label: 'Tema definido', done: false },
    { label: 'Rascunho escrito', done: false },
    { label: 'Links verificados', done: false },
    { label: 'Preview testado', done: false },
    { label: 'Segmentação confirmada', done: false },
  ],
  course: [
    { label: 'Módulos definidos', done: false },
    { label: 'Material de cada módulo criado', done: false },
    { label: 'Exercícios/quizzes prontos', done: false },
    { label: 'Revisão de conteúdo', done: false },
    { label: 'Landing page criada', done: false },
  ],
  campaign: [
    { label: 'Objetivo definido', done: false },
    { label: 'Criativos prontos', done: false },
    { label: 'Segmentação definida', done: false },
    { label: 'Budget aprovado', done: false },
    { label: 'Tracking configurado', done: false },
  ],
}

export function getNextStage(format: Format, currentStage: string): string | null {
  const workflow = WORKFLOWS[format]
  const current = workflow.find((s) => s.stage === currentStage)
  if (!current) return null
  const next = workflow.find((s) => s.position === current.position + 1)
  return next?.stage ?? null
}

export function getPreviousStage(format: Format, currentStage: string): string | null {
  const workflow = WORKFLOWS[format]
  const current = workflow.find((s) => s.stage === currentStage)
  if (!current) return null
  const prev = workflow.find((s) => s.position === current.position - 1)
  return prev?.stage ?? null
}

export function getStagePosition(format: Format, stage: string): number {
  const workflow = WORKFLOWS[format]
  return workflow.find((s) => s.stage === stage)?.position ?? 0
}

export function isFinalStage(format: Format, stage: string): boolean {
  const workflow = WORKFLOWS[format]
  const maxPosition = Math.max(...workflow.map((s) => s.position))
  return getStagePosition(format, stage) === maxPosition
}

export function isFirstStage(format: Format, stage: string): boolean {
  return getStagePosition(format, stage) === 1
}

export function generateCode(format: Format, title: string, metadata?: Record<string, unknown>): string {
  const slug = title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  switch (format) {
    case 'video': {
      const letter = (metadata?.playlist_letter as string) || ''
      const ep = (metadata?.episode_number as number) || ''
      return letter && ep ? `${letter}${ep}-${slug}` : `vid-${slug}`
    }
    case 'blog_post':
      return `blog-${slug}`
    case 'newsletter':
      return `nl-${slug}`
    case 'course':
      return `course-${slug}`
    case 'campaign':
      return `camp-${slug}`
  }
}
