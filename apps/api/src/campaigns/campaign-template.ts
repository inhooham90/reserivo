import { LEGAL } from '@reserivo/shared';
import type { RenderedEmail } from '../notifications/templates.js';
import { esc } from '../notifications/templates.js';

export interface CampaignMail {
  salonName: string;
  subject: string;
  /** What the salon typed. Plain text; blank lines separate paragraphs. */
  body: string;
  unsubscribeUrl: string;
}

/**
 * A campaign as it goes out, and the reason campaigns do not reuse `render()`.
 *
 * Everything below the salon's own words is legally required and must not be
 * something a sender can edit away:
 *   - a working unsubscribe link (CAN-SPAM), in both the text and HTML parts
 *   - the operator's physical postal address (CAN-SPAM)
 *   - who sent it, so the message is not deceptive about its origin
 *
 * The one-click List-Unsubscribe headers that Gmail and Yahoo require of bulk
 * senders are set by MarketingMailer, not here — they are envelope, not body.
 */
export function renderCampaign(mail: CampaignMail): RenderedEmail {
  const paragraphs = mail.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const text = [
    ...paragraphs,
    '—',
    `Sent by ${mail.salonName} using ${LEGAL.product}.`,
    `Unsubscribe from ${mail.salonName}, or from every salon on ${LEGAL.product}: ${mail.unsubscribeUrl}`,
    `${LEGAL.legalName}, ${LEGAL.address}`,
  ].join('\n\n');

  const bodyHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font:15px/1.6 -apple-system,Segoe UI,sans-serif;color:#2a2622">${esc(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');

  const footer = `
    <hr style="margin:28px 0 16px;border:0;border-top:1px solid #e9e3da">
    <p style="margin:0 0 6px;font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#7a7168">
      Sent by ${esc(mail.salonName)} using ${esc(LEGAL.product)}.
      <a href="${esc(mail.unsubscribeUrl)}" style="color:#7a7168">Unsubscribe from ${esc(mail.salonName)}</a>, or from every salon on ${esc(LEGAL.product)}.
    </p>
    <p style="margin:0;font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#7a7168">
      ${esc(LEGAL.legalName)}, ${esc(LEGAL.address)}
    </p>`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#faf8f4"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e9e3da;border-radius:12px;padding:28px"><h1 style="margin:0 0 16px;font:600 22px Georgia,serif;color:#2a2622">${esc(mail.salonName)}</h1>${bodyHtml}${footer}</div></body></html>`;

  return { subject: mail.subject, text, html };
}
