import { customAlphabet } from 'nanoid'

/**
 * 56-character alphabet excluding confusable characters: 0, O, l, 1, I
 */
export const SAFE_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generates unique short codes using nanoid with a safe alphabet.
 * Supports collision retry via an `isAvailable` callback.
 */
export class CodeGenerator {
  private readonly generate_: (size?: number) => string
  private readonly length: number
  private readonly maxRetries: number

  constructor(length = 6, maxRetries = 3) {
    this.length = length
    this.maxRetries = maxRetries
    this.generate_ = customAlphabet(SAFE_ALPHABET, length)
  }

  /**
   * Generate a unique code, checking availability via callback.
   * Retries up to `maxRetries` times on collision.
   */
  async generate(isAvailable: (code: string) => Promise<boolean>): Promise<string> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const code = this.generate_(this.length)
      if (await isAvailable(code)) {
        return code
      }
    }
    throw new Error(`CodeGenerator: max retries (${this.maxRetries}) exceeded — all codes collided`)
  }

  /**
   * Validate that a custom code only contains safe alphabet characters.
   */
  isValidCode(code: string): boolean {
    for (const ch of code) {
      if (!SAFE_ALPHABET.includes(ch)) {
        return false
      }
    }
    return code.length > 0
  }
}
