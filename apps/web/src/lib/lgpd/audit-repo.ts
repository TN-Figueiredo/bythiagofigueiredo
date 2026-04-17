import type { SupabaseClient } from '@supabase/supabase-js';
import type { ILgpdAuditLogRepository } from '@tn-figueiredo/lgpd/interfaces';
import type {
  CreateLgpdAuditEntryInput,
  LgpdAuditEntry,
} from '@tn-figueiredo/lgpd/types';

interface AuditLogRow {
  id: string;
  resource_id: string | null;
  actor_user_id: string | null;
  action: string;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

function rowToEntry(row: AuditLogRow): LgpdAuditEntry {
  const entry: LgpdAuditEntry = {
    id: row.id,
    action: row.action,
    createdAt: new Date(row.created_at),
  };
  if (row.resource_id) entry.lgpdRequestId = row.resource_id;
  if (row.actor_user_id) {
    entry.userId = row.actor_user_id;
    entry.performedBy = row.actor_user_id;
  }
  if (row.after_data) entry.details = row.after_data;
  return entry;
}

/**
 * Thin wrapper over the Sprint 4.75 `audit_log` table — no separate
 * lgpd_audit_log ships in Sprint 5a. We encode LGPD phase transitions as rows
 * with `resource_type = 'lgpd_request'` and `action` using the convention
 * `lifecycle_<event>` (e.g. `lifecycle_deletion_requested`,
 * `lifecycle_phase1_complete`), matching the RLS policies added in
 * migration 014 (`audit_log_self_lifecycle_target`, `audit_log_self_as_actor`).
 *
 * The package's LgpdAuditEntry shape is flatter than the DB row; we adapt
 * both ways in this file and keep the richer DB row (ip, user_agent, site_id,
 * org_id, before_data) as extra context written by the Sprint 4.75 trigger.
 */
export class AuditLogLgpdRepository implements ILgpdAuditLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(data: CreateLgpdAuditEntryInput): Promise<LgpdAuditEntry> {
    const row = {
      resource_type: 'lgpd_request' as const,
      resource_id: data.lgpdRequestId ?? null,
      actor_user_id: data.performedBy ?? data.userId ?? null,
      action: data.action,
      after_data: data.details ?? null,
    };

    const { data: created, error } = await this.supabase
      .from('audit_log')
      .insert(row)
      .select('id, resource_id, actor_user_id, action, after_data, created_at')
      .single();

    if (error || !created) {
      throw new Error(`audit_log insert failed: ${error?.message ?? 'unknown'}`);
    }
    return rowToEntry(created as AuditLogRow);
  }

  async findByRequestId(requestId: string): Promise<LgpdAuditEntry[]> {
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('id, resource_id, actor_user_id, action, after_data, created_at')
      .eq('resource_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`audit_log findByRequestId failed: ${error.message}`);
    }
    return ((data ?? []) as AuditLogRow[]).map(rowToEntry);
  }

  async countByAction(action: string): Promise<number> {
    const { count, error } = (await this.supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', action)) as { count: number | null; error: { message: string } | null };

    if (error) {
      throw new Error(`audit_log countByAction failed: ${error.message}`);
    }
    return count ?? 0;
  }
}
