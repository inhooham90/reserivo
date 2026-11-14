import { Injectable } from '@nestjs/common';
import type { LiveEvent } from '@reserivo/shared';
import { filter, interval, map, merge, Observable, Subject } from 'rxjs';

/**
 * In-process fan-out for the live stream. Each open browser tab holds one
 * `GET /me/events` connection; `publish` delivers an event to every
 * connection of the named users.
 *
 * In-process means one dyno. With two, a message posted on one would only
 * reach tabs connected to that one. The seam for that day is here: publish to
 * Redis pub/sub (or Postgres LISTEN/NOTIFY) and feed this Subject from it.
 * Nothing is lost meanwhile either way, because the stream only says "go and
 * refetch": the unread poll and the email nudge still cover anyone it misses.
 */
@Injectable()
export class LiveEventsService {
  private readonly bus = new Subject<{ userIds: Set<string>; event: LiveEvent }>();

  publish(userIds: Iterable<string | null | undefined>, event: LiveEvent): void {
    const ids = new Set([...userIds].filter((id): id is string => Boolean(id)));
    if (ids.size) this.bus.next({ userIds: ids, event });
  }

  /**
   * One user's stream, with a ping every 25 seconds: proxies, and Heroku's
   * router in particular (55 s of silence), close an idle connection.
   */
  streamFor(userId: string): Observable<{ data: LiveEvent }> {
    const mine = this.bus.pipe(
      filter((m) => m.userIds.has(userId)),
      map((m) => ({ data: m.event })),
    );
    const ping = interval(25_000).pipe(map(() => ({ data: { type: 'ping' } as LiveEvent })));
    return merge(mine, ping);
  }
}
