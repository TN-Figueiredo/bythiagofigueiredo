import type { ILinkRepository } from '../interfaces/link-repository.js'
import type { IQrStorage } from '../interfaces/storage.js'
import type {
  TrackedLink,
  CreateLinkInput,
  UpdateLinkInput,
  LinkFilters,
  PaginatedResult,
} from '../types.js'
import { CodeGenerator } from './code-generator.js'

/**
 * CRUD orchestrator for tracked links.
 * Pure business logic — no DB or framework dependencies.
 */
export class LinkService {
  private readonly linkRepo: ILinkRepository
  private readonly qrStorage: IQrStorage
  private readonly codeGenerator: CodeGenerator

  constructor(linkRepo: ILinkRepository, qrStorage: IQrStorage) {
    this.linkRepo = linkRepo
    this.qrStorage = qrStorage
    this.codeGenerator = new CodeGenerator()
  }

  async createLink(input: CreateLinkInput): Promise<TrackedLink> {
    // Validate URL
    this.validateUrl(input.destinationUrl)

    // Resolve code
    let code: string
    if (input.code) {
      // Custom code — check availability
      const available = await this.linkRepo.isCodeAvailable(input.code)
      if (!available) {
        throw new Error(`Code "${input.code}" is unavailable — already exists`)
      }
      code = input.code
    } else {
      // Auto-generate
      code = await this.codeGenerator.generate(
        (candidate) => this.linkRepo.isCodeAvailable(candidate),
      )
    }

    // Check slug availability if provided
    if (input.slug) {
      const slugAvailable = await this.linkRepo.isSlugAvailable(input.siteId, input.slug)
      if (!slugAvailable) {
        throw new Error(`Slug "${input.slug}" is unavailable — already exists`)
      }
    }

    return this.linkRepo.create({ ...input, code })
  }

  async updateLink(id: string, input: UpdateLinkInput): Promise<TrackedLink> {
    if (input.destinationUrl) {
      this.validateUrl(input.destinationUrl)
    }
    return this.linkRepo.update(id, input)
  }

  async softDelete(id: string): Promise<void> {
    return this.linkRepo.softDelete(id)
  }

  async attachQr(linkId: string, svgContent: string): Promise<string> {
    const key = `qr/${linkId}.svg`
    const url = await this.qrStorage.upload(key, svgContent, 'image/svg+xml')
    await this.linkRepo.update(linkId, { qrCodeUrl: url })
    return url
  }

  async getLink(id: string): Promise<TrackedLink | null> {
    return this.linkRepo.findById(id)
  }

  async listLinks(filters: LinkFilters): Promise<PaginatedResult<TrackedLink>> {
    return this.linkRepo.list(filters)
  }

  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only http/https URLs are allowed')
      }
    } catch {
      throw new Error(`Invalid URL: "${url}" — must be a valid http/https URL`)
    }
  }
}
