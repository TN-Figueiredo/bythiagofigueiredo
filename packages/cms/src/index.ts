// ---- Types (explicit re-exports; kept alphabetized by file) ----
export type {
  ContentStatus,
  ContentListOpts,
  ContentCountOpts,
  TocEntry,
  CompiledMdx,
} from './types/content'
export type {
  PostTranslation,
  Post,
  PostListItem,
  CreatePostInput,
  UpdatePostInput,
} from './types/post'
export type {
  CampaignExtras,
  CampaignTranslation,
  CampaignFormField,
  Campaign,
  CampaignListItem,
  CreateCampaignInput,
  UpdateCampaignInput,
} from './types/campaign'
export type { Organization, Site } from './types/organization'
export {
  ContentStatusZ,
  TocEntryZ,
  PostTranslationZ,
  PostZ,
  CreatePostInputZ,
} from './types/schemas'

// ---- Interfaces ----
export type { IContentRepository } from './interfaces/content-repository'
export type { IPostRepository } from './interfaces/post-repository'
export type { ICampaignRepository } from './interfaces/campaign-repository'
export type { IContentRenderer, ComponentRegistry } from './interfaces/content-renderer'
export type { IRingContext } from './interfaces/ring-context'
export { compileMdx } from './mdx/compiler'
export { MdxRunner } from './mdx/renderer'
export { defaultComponents } from './mdx/default-components'
export { extractToc } from './mdx/toc'
export { calculateReadingTime } from './mdx/reading-time'
export { renderCampaignLandingMarkdown } from './campaigns/render'
export { SupabaseContentRepository } from './supabase/content-repository'
export { SupabasePostRepository } from './supabase/post-repository'
export { SupabaseCampaignRepository } from './supabase/campaign-repository'
export { SupabaseRingContext } from './supabase/ring-context'
export { uploadContentAsset } from './supabase/asset-upload'
export type { UploadContentAssetOpts, UploadedAsset } from './supabase/asset-upload'
export { EditorToolbar, applyToolbarAction } from './editor/toolbar'
export { EditorPreview } from './editor/preview'
export { AssetPicker } from './editor/asset-picker'
export { PostEditor } from './editor/editor'
export type { ToolbarAction, EditorToolbarProps } from './editor/toolbar'
export type { EditorPreviewProps } from './editor/preview'
export type { AssetPickerProps } from './editor/asset-picker'
export type { PostEditorProps, SavePostInput, SaveResult } from './editor/editor'
export { CampaignEditor } from './editor/campaign-editor'
export type {
  CampaignEditorProps,
  CampaignEditorInitialCampaign,
  CampaignEditorInitialTranslation,
  CampaignEditorSaveInput,
  CampaignEditorSaveResult,
} from './editor/campaign-editor'
export { CampaignMetaForm } from './editor/campaign-meta-form'
export type {
  CampaignMetaFormProps,
  CampaignMetaFormValue,
  CampaignStatus,
} from './editor/campaign-meta-form'
export { CampaignTranslationForm } from './editor/campaign-translation-form'
export type {
  CampaignTranslationFormProps,
  CampaignTranslationFormValue,
} from './editor/campaign-translation-form'
export { getEditorStrings, EDITOR_STRINGS, ptBR, en } from './editor/strings'
export type { EditorStrings } from './editor/strings'
export { useAutosave } from './hooks/use-autosave'
export type { UseAutosaveOptions, UseAutosaveResult } from './hooks/use-autosave'
export { getNewDraftId, clearNewDraftId } from './hooks/new-draft-id'
export { isSafeUrl } from './lib/url'
