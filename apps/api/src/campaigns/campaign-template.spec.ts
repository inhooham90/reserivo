import { LEGAL } from '@reserivo/shared';
import { renderCampaign } from './campaign-template.js';

/**
 * These are not style assertions. The unsubscribe link and the postal address
 * are what make a marketing email lawful under CAN-SPAM, and the whole point
 * of rendering campaigns through their own template is that a sender cannot
 * compose them away. If one of these ever fails, the send is not shippable.
 */
describe('renderCampaign', () => {
  const mail = {
    salonName: 'Glow Salon',
    subject: 'Spring colour, 20% off',
    body: 'Hello!\n\nWe have space this month.',
    unsubscribeUrl: 'https://morrri.com/u/tok-123',
  };

  it('carries the unsubscribe link in both parts', () => {
    const out = renderCampaign(mail);
    expect(out.text).toContain(mail.unsubscribeUrl);
    expect(out.html).toContain(mail.unsubscribeUrl);
  });

  it('carries the operator’s postal address in both parts', () => {
    const out = renderCampaign(mail);
    expect(out.text).toContain(LEGAL.address);
    expect(out.html).toContain(LEGAL.address);
  });

  it('names the salon as the sender, so the origin is not deceptive', () => {
    const out = renderCampaign(mail);
    expect(out.text).toContain('Sent by Glow Salon');
    expect(out.html).toContain('Sent by Glow Salon');
  });

  it('keeps the subject the salon chose', () => {
    expect(renderCampaign(mail).subject).toBe('Spring colour, 20% off');
  });

  it('splits blank-line-separated text into paragraphs', () => {
    const out = renderCampaign(mail);
    expect(out.html).toContain('Hello!');
    expect(out.html).toContain('We have space this month.');
  });

  it('escapes the body, so a salon cannot inject markup into its own send', () => {
    const out = renderCampaign({ ...mail, body: '<script>alert(1)</script>' });
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('escapes the salon name too', () => {
    const out = renderCampaign({ ...mail, salonName: 'Tom & "Jerry"' });
    expect(out.html).toContain('Tom &amp; &quot;Jerry&quot;');
  });
});
