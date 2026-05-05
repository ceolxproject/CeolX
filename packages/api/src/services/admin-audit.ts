import type { db } from '@CeolX/db';
import { adminAuditLog } from '@CeolX/db/schema/admin';

// `DbHandle` covers both the top-level db and a drizzle transaction handle —
// both expose the .insert(table).values(...) chain we need.
type DbHandle = typeof db;

// Action identifiers — keep in sync with the docs/admin-audit-log.md inventory.
// Adding a new action here is the only place a future admin feature should
// touch this module.
export const AdminAuditAction = {
  EVENT_REMOVE: 'event.remove',
  EVENT_RESTORE: 'event.restore',
} as const;

export type AdminAuditAction = (typeof AdminAuditAction)[keyof typeof AdminAuditAction];

export const AdminAuditTargetType = {
  EVENT: 'event',
} as const;

export type AdminAuditTargetType = (typeof AdminAuditTargetType)[keyof typeof AdminAuditTargetType];

export interface LogAdminActionInput {
  adminId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Best-effort write: callers wrap this in `.catch(...)` because audit failure
// must not block a moderation action. The failure mode is loud (console.error
// at the call site) so it's still observable in server logs.
export async function logAdminAction(handle: DbHandle, input: LogAdminActionInput): Promise<void> {
  await handle.insert(adminAuditLog).values({
    adminId: input.adminId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
  });
}
