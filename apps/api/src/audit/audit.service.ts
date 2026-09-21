import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface AuditEntry {
  user: AuthenticatedUser | null;
  salonId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_KEY = /password|token|secret|authorization|cookie/i;

/** Deep-copies a value with any sensitive-looking keys replaced. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1),
    ]),
  );
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one audit row. Never throws: a failed audit write is logged, not
   * surfaced, because it must not roll back the action it describes.
   */
  async record(entry: AuditEntry): Promise<void> {
    const { user } = entry;
    try {
      await this.prisma.auditLog.create({
        data: {
          // The person whose hands were on the keyboard.
          actorUserId: user?.actorUserId ?? user?.id ?? null,
          // Set only when an admin acted as someone else.
          impersonatedUserId: user?.actorUserId ? user.id : null,
          salonId: entry.salonId ?? null,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          before: (redact(entry.before) ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (redact(entry.after) ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Audit write failed for ${entry.action}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
