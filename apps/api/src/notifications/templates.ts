import type { NotificationEvent } from './notifications.types.js';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function when(startAt: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  }).format(new Date(startAt));
}

function wrap(title: string, lines: string[], cta?: { label: string; href: string }): string {
  const body = lines.map((l) => `<p style="margin:0 0 12px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#2a2622">${esc(l)}</p>`).join('');
  const button = cta
    ? `<p style="margin:20px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#b5563b;color:#fff;text-decoration:none;font:600 14px -apple-system,Segoe UI,sans-serif">${esc(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#faf8f4"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e9e3da;border-radius:12px;padding:28px"><h1 style="margin:0 0 16px;font:600 22px Georgia,serif;color:#2a2622">${esc(title)}</h1>${body}${button}</div></body></html>`;
}

/** Plain-text first; HTML is the same content with a button. */
export function render(event: NotificationEvent, webUrl: string): RenderedEmail {
  switch (event.type) {
    case 'appointment.booked': {
      const d = event.data;
      const at = when(d.startAt, d.timezone);
      const lines = [`Hi ${event.to.name},`, `You're booked for ${d.serviceName} with ${d.designerName} at ${d.salonName}.`, at];
      const cta = { label: 'See my appointments', href: `${webUrl}/appointments` };
      return {
        subject: `Booked: ${d.serviceName} at ${d.salonName}`,
        text: `${lines.join('\n\n')}\n\nManage it here: ${cta.href}`,
        html: wrap("You're booked", lines, cta),
      };
    }
    case 'appointment.rescheduled': {
      const d = event.data;
      const at = when(d.startAt, d.timezone);
      const lines = [`Hi ${event.to.name},`, `Your ${d.serviceName} with ${d.designerName} at ${d.salonName} has a new time:`, at];
      const cta = { label: 'See my appointments', href: `${webUrl}/appointments` };
      return {
        subject: `New time: ${d.serviceName} at ${d.salonName}`,
        text: `${lines.join('\n\n')}\n\n${cta.href}`,
        html: wrap('Your appointment moved', lines, cta),
      };
    }
    case 'appointment.cancelled': {
      const d = event.data;
      const at = when(d.startAt, d.timezone);
      const lines = [`Hi ${event.to.name},`, `Your ${d.serviceName} with ${d.designerName} at ${d.salonName} on ${at} has been cancelled.`];
      const cta = { label: 'Book again', href: `${webUrl}/appointments` };
      return {
        subject: `Cancelled: ${d.serviceName} at ${d.salonName}`,
        text: `${lines.join('\n\n')}\n\n${cta.href}`,
        html: wrap('Appointment cancelled', lines, cta),
      };
    }
    case 'message.received': {
      const d = event.data;
      // Deliberately no message body: the email is a nudge, the conversation lives in the app.
      const lines = [`Hi ${event.to.name},`, `${d.fromName} sent you a message at ${d.salonName}.`];
      const cta = { label: 'Open the conversation', href: d.link };
      return {
        subject: `New message from ${d.fromName} · ${d.salonName}`,
        text: `${lines.join('\n\n')}\n\n${cta.href}`,
        html: wrap('New message', lines, cta),
      };
    }
  }
}
