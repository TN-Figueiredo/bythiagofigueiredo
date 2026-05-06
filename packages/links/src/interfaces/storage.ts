/**
 * Contract for QR code storage (Supabase Storage, S3, etc.).
 */
export interface IQrStorage {
  upload(key: string, svg: string, contentType?: string): Promise<string> // returns public URL
  delete(key: string): Promise<void>
}
