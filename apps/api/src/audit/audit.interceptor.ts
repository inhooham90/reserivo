import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { paramString } from '../tenancy/salon-membership.guard.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { AuditService } from './audit.service.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/**
 * Endpoints that hand out credentials: their bodies are never worth
 * persisting, and impersonation writes its own labelled row instead.
 */
const SKIP_PREFIXES = ['/auth/', '/admin/impersonate/'];

type AuditedRequest = Request & { user?: AuthenticatedUser; tenant?: TenantContext };

/**
 * Global interceptor: every successful mutating request writes an AuditLog row
 * with the route, the redacted request body, and the response's `id` if any.
 * Domain services can call AuditService directly for richer before/after diffs.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuditedRequest>();
    if (!MUTATING.has(req.method) || SKIP_PREFIXES.some((p) => req.path.startsWith(p))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response) => {
        const routePath: string = req.route?.path ?? req.path;
        const entityType = routePath.split('/').filter(Boolean)[0] ?? null;
        const responseId =
          response && typeof response === 'object' && typeof (response as { id?: unknown }).id === 'string'
            ? (response as { id: string }).id
            : null;

        void this.audit.record({
          user: req.user ?? null,
          salonId: req.tenant?.salonId ?? paramString(req.params.salonId) ?? null,
          action: `${req.method} ${routePath}`,
          entityType,
          entityId: responseId ?? paramString(req.params.id) ?? null,
          after: { params: req.params, body: req.body },
          ip: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        });
      }),
    );
  }
}
