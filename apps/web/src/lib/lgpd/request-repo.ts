import type { SupabaseClient } from '@supabase/supabase-js';
import type { ILgpdRequestRepository } from '@tn-figueiredo/lgpd/interfaces';
import type {
  CreateLgpdRequestInput,
  DeletionPhase,
  LgpdRequest,
  LgpdRequestStatus,
  LgpdRequestType,
} from '@tn-figueiredo/lgpd/types';

interface LgpdRequestRow {
  id: string;
  user_id: string;
  request_type: LgpdRequestType;
  status: LgpdRequestStatus;
  confirmation_token_hash: string | null;
  confirmation_expires_at: string | null;
  deletion_phase: DeletionPhase | null;
  processed_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  download_url: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

function dateOrUndef(v: string | null): Date | undefined {
  return v ? new Date(v) : undefined;
}

function rowToRequest(row: LgpdRequestRow): LgpdRequest {
  const r: LgpdRequest = {
    id: row.id,
    userId: row.user_id,
    requestType: row.request_type,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
  if (row.confirmation_token_hash) r.confirmationToken = row.confirmation_token_hash;
  const cExpires = dateOrUndef(row.confirmation_expires_at);
  if (cExpires) r.confirmationExpiresAt = cExpires;
  if (row.deletion_phase != null) r.deletionPhase = row.deletion_phase;
  const processedAt = dateOrUndef(row.processed_at);
  if (processedAt) r.processedAt = processedAt;
  const completedAt = dateOrUndef(row.completed_at);
  if (completedAt) r.completedAt = completedAt;
  const expiresAt = dateOrUndef(row.expires_at);
  if (expiresAt) r.expiresAt = expiresAt;
  if (row.download_url != null) r.downloadUrl = row.download_url;
  if (row.file_path != null) r.filePath = row.file_path;
  if (row.file_size_bytes != null) r.fileSizeBytes = row.file_size_bytes;
  if (row.admin_notes) r.adminNotes = row.admin_notes;
  return r;
}

const SELECT_COLS =
  'id, user_id, request_type, status, confirmation_token_hash, confirmation_expires_at, deletion_phase, processed_at, completed_at, expires_at, download_url, file_path, file_size_bytes, admin_notes, created_at, updated_at';

/**
 * CRUD on the `lgpd_requests` table (migration 001 of Track A). This adapter
 * expects the caller to hand it the right Supabase client: service-role for
 * admin flows + cron, authenticated client when we want RLS to scope reads
 * to the current user's own rows.
 *
 * The `LgpdRequest` domain type (camelCase) and the DB row (snake_case) are
 * kept distinct; `rowToRequest` is the single adapter boundary.
 */
export class SupabaseLgpdRequestRepository implements ILgpdRequestRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateLgpdRequestInput): Promise<LgpdRequest> {
    const row: Record<string, unknown> = {
      user_id: input.userId,
      request_type: input.requestType,
      status: 'pending' as const,
    };
    if (input.confirmationToken) row.confirmation_token_hash = input.confirmationToken;
    if (input.confirmationExpiresAt)
      row.confirmation_expires_at = input.confirmationExpiresAt.toISOString();

    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .insert(row)
      .select(SELECT_COLS)
      .single();

    if (error || !data) {
      throw new Error(`lgpd_requests insert failed: ${error?.message ?? 'unknown'}`);
    }
    return rowToRequest(data as LgpdRequestRow);
  }

  async findById(id: string): Promise<LgpdRequest | null> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select(SELECT_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`lgpd_requests findById failed: ${error.message}`);
    return data ? rowToRequest(data as LgpdRequestRow) : null;
  }

  async findByUserId(userId: string): Promise<LgpdRequest[]> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select(SELECT_COLS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`lgpd_requests findByUserId failed: ${error.message}`);
    return ((data ?? []) as LgpdRequestRow[]).map(rowToRequest);
  }

  async findPendingByUserId(
    userId: string,
    type: LgpdRequestType,
  ): Promise<LgpdRequest | null> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select(SELECT_COLS)
      .eq('user_id', userId)
      .eq('request_type', type)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`lgpd_requests findPendingByUserId failed: ${error.message}`);
    return data ? rowToRequest(data as LgpdRequestRow) : null;
  }

  async findByConfirmationToken(tokenHash: string): Promise<LgpdRequest | null> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select(SELECT_COLS)
      .eq('confirmation_token_hash', tokenHash)
      .maybeSingle();
    if (error)
      throw new Error(`lgpd_requests findByConfirmationToken failed: ${error.message}`);
    return data ? rowToRequest(data as LgpdRequestRow) : null;
  }

  async findByDeletionPhaseOlderThan(
    phase: DeletionPhase,
    olderThan: Date,
  ): Promise<LgpdRequest[]> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select(SELECT_COLS)
      .eq('request_type', 'account_deletion')
      .eq('deletion_phase', phase)
      .lt('updated_at', olderThan.toISOString());
    if (error)
      throw new Error(`lgpd_requests findByDeletionPhaseOlderThan failed: ${error.message}`);
    return ((data ?? []) as LgpdRequestRow[]).map(rowToRequest);
  }

  async findPendingExports(): Promise<LgpdRequest[]> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select(SELECT_COLS)
      .eq('request_type', 'data_export')
      .in('status', ['pending', 'processing']);
    if (error) throw new Error(`lgpd_requests findPendingExports failed: ${error.message}`);
    return ((data ?? []) as LgpdRequestRow[]).map(rowToRequest);
  }

  async findExpiredExports(now: Date = new Date()): Promise<LgpdRequest[]> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select(SELECT_COLS)
      .eq('request_type', 'data_export')
      .lt('expires_at', now.toISOString());
    if (error) throw new Error(`lgpd_requests findExpiredExports failed: ${error.message}`);
    return ((data ?? []) as LgpdRequestRow[]).map(rowToRequest);
  }

  async update(
    id: string,
    patch: Partial<{
      status: LgpdRequestStatus;
      processedAt: Date;
      completedAt: Date;
      expiresAt: Date;
      downloadUrl: string | null;
      filePath: string | null;
      fileSizeBytes: number;
      deletionPhase: DeletionPhase;
      adminNotes: string;
    }>,
  ): Promise<LgpdRequest> {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.processedAt) row.processed_at = patch.processedAt.toISOString();
    if (patch.completedAt) row.completed_at = patch.completedAt.toISOString();
    if (patch.expiresAt) row.expires_at = patch.expiresAt.toISOString();
    if (patch.downloadUrl !== undefined) row.download_url = patch.downloadUrl;
    if (patch.filePath !== undefined) row.file_path = patch.filePath;
    if (patch.fileSizeBytes !== undefined) row.file_size_bytes = patch.fileSizeBytes;
    if (patch.deletionPhase !== undefined) row.deletion_phase = patch.deletionPhase;
    if (patch.adminNotes !== undefined) row.admin_notes = patch.adminNotes;
    row.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .update(row)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (error || !data)
      throw new Error(`lgpd_requests update failed: ${error?.message ?? 'unknown'}`);
    return rowToRequest(data as LgpdRequestRow);
  }

  async countByStatus(status: LgpdRequestStatus): Promise<number> {
    const { count, error } = (await this.supabase
      .from('lgpd_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)) as { count: number | null; error: { message: string } | null };
    if (error) throw new Error(`lgpd_requests countByStatus failed: ${error.message}`);
    return count ?? 0;
  }

  async countByTypeAndStatus(
    type: LgpdRequestType,
    status: LgpdRequestStatus,
  ): Promise<number> {
    const { count, error } = (await this.supabase
      .from('lgpd_requests')
      .select('*', { count: 'exact', head: true })
      .eq('request_type', type)
      .eq('status', status)) as { count: number | null; error: { message: string } | null };
    if (error)
      throw new Error(`lgpd_requests countByTypeAndStatus failed: ${error.message}`);
    return count ?? 0;
  }

  async countCompletedThisMonth(type: LgpdRequestType): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count, error } = (await this.supabase
      .from('lgpd_requests')
      .select('*', { count: 'exact', head: true })
      .eq('request_type', type)
      .eq('status', 'completed')
      .gt('completed_at', start)) as {
        count: number | null;
        error: { message: string } | null;
      };
    if (error)
      throw new Error(`lgpd_requests countCompletedThisMonth failed: ${error.message}`);
    return count ?? 0;
  }

  async avgProcessingTime(type: LgpdRequestType): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('lgpd_requests')
      .select('created_at, completed_at')
      .eq('request_type', type)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    if (error) throw new Error(`lgpd_requests avgProcessingTime failed: ${error.message}`);

    const rows = (data ?? []) as Array<{ created_at: string; completed_at: string | null }>;
    const durations = rows
      .filter((r): r is { created_at: string; completed_at: string } => !!r.completed_at)
      .map((r) => new Date(r.completed_at).getTime() - new Date(r.created_at).getTime())
      .filter((n) => Number.isFinite(n) && n >= 0);
    if (durations.length === 0) return null;
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    return avgMs / 1000; // seconds
  }
}
