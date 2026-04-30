import { describe, it, expect, vi } from 'vitest';

// Mock @tn-figueiredo/email to avoid transitive nodemailer import (optional peer dep)
vi.mock('@tn-figueiredo/email', () => ({
  emailLayout: ({ body }: { body: string }) => `<html><body>${body}</body></html>`,
  emailButton: ({ url, label }: { url: string; label: string }) =>
    `<a href="${url}">${label}</a>`,
  formatDatePtBR: (d: Date) => d.toISOString(),
}));

import { LgpdEmailService } from './email-service';

function makeEmailService() {
  const send = vi.fn().mockResolvedValue({ messageId: 'm1', provider: 'ses' });
  const sendTemplate = vi.fn().mockResolvedValue({ messageId: 'm1', provider: 'ses' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { send, sendTemplate, handleWebhook: vi.fn() } as any;
}

const sender = { email: 'noreply@bythiagofigueiredo.com', name: 'bythiagofigueiredo' };

describe('LgpdEmailService', () => {
  it('sendDeletionConfirmation calls send with a confirmation subject + URL', async () => {
    const inner = makeEmailService();
    const svc = new LgpdEmailService(inner, { sender });
    const expires = new Date('2026-04-17T00:00:00Z');
    await svc.sendDeletionConfirmation('a@x.com', 'https://app/confirm?t=abc', expires);

    expect(inner.send).toHaveBeenCalledTimes(1);
    const msg = inner.send.mock.calls[0][0];
    expect(msg.to).toBe('a@x.com');
    expect(msg.subject.toLowerCase()).toMatch(/exclus|delet/);
    expect(msg.html).toContain('https://app/confirm?t=abc');
    expect(msg.from).toEqual(sender);
  });

  it('sendExportReady embeds the signed download URL', async () => {
    const inner = makeEmailService();
    const svc = new LgpdEmailService(inner, { sender });
    const expires = new Date('2026-04-23T00:00:00Z');
    await svc.sendExportReady('a@x.com', 'https://storage/signed/x', expires);

    const msg = inner.send.mock.calls[0][0];
    expect(msg.html).toContain('https://storage/signed/x');
    expect(msg.subject.toLowerCase()).toMatch(/export|dados/);
  });

  it('sendCleanupWarning includes the days-remaining copy', async () => {
    const inner = makeEmailService();
    const svc = new LgpdEmailService(inner, { sender });
    await svc.sendCleanupWarning('a@x.com', 30);

    const msg = inner.send.mock.calls[0][0];
    expect(msg.html).toMatch(/30/);
  });

  it('sendCleanupFinalWarning sends a distinct final subject', async () => {
    const inner = makeEmailService();
    const svc = new LgpdEmailService(inner, { sender });
    await svc.sendCleanupFinalWarning('a@x.com');

    const msg = inner.send.mock.calls[0][0];
    expect(msg.subject.toLowerCase()).toMatch(/final|último|ultima/);
  });

  it('sendConsentRevocationConfirmation acknowledges the revocation', async () => {
    const inner = makeEmailService();
    const svc = new LgpdEmailService(inner, { sender });
    await svc.sendConsentRevocationConfirmation('a@x.com');

    const msg = inner.send.mock.calls[0][0];
    expect(msg.subject.toLowerCase()).toMatch(/consent/);
    expect(msg.html.toLowerCase()).toMatch(/revog|withdraw/);
  });

  it('propagates errors from underlying send', async () => {
    const inner = makeEmailService();
    inner.send.mockRejectedValueOnce(new Error('ses 500'));
    const svc = new LgpdEmailService(inner, { sender });
    await expect(
      svc.sendConsentRevocationConfirmation('a@x.com'),
    ).rejects.toThrow(/ses 500/);
  });
});
