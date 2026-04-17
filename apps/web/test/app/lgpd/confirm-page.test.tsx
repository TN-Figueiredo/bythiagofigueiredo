import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    // Real Next throws a NEXT_REDIRECT error that the framework catches
    // to issue the 302. We mirror the throw so the server component's
    // control flow short-circuits identically under test.
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const lookupFn = vi.fn();

vi.mock('@/lib/lgpd/container', () => ({
  createLgpdContainer: () => ({
    tokenLookup: {
      resolve: lookupFn,
    },
  }),
}));

import ConfirmPage from '../../../src/app/lgpd/confirm/[token]/page';

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function ctx(token: string, search: Record<string, string> = {}) {
  return {
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve(search),
  };
}

describe('/lgpd/confirm/[token] page', () => {
  it('shows invalid UI when token is empty', async () => {
    const jsx = await ConfirmPage(ctx(''));
    render(jsx as React.ReactElement);
    expect(screen.getByRole('heading')).toBeTruthy();
  });

  it('redirects 302 to download signed URL when token is a data_export', async () => {
    lookupFn.mockResolvedValueOnce({
      kind: 'data_export',
      signedUrl: 'https://s.local/signed?x=1',
    });
    await expect(ConfirmPage(ctx('exp-token'))).rejects.toThrow(
      /NEXT_REDIRECT:https:\/\/s.local\/signed/,
    );
  });

  it('renders confirm-deletion action when token is account_deletion', async () => {
    lookupFn.mockResolvedValueOnce({
      kind: 'account_deletion',
      userId: 'u1',
    });
    const jsx = await ConfirmPage(ctx('del-token'));
    render(jsx as React.ReactElement);
    expect(screen.getByRole('heading')).toBeTruthy();
    // should include a form posting to confirm-deletion
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('renders cancel UI when action=cancel', async () => {
    lookupFn.mockResolvedValueOnce({
      kind: 'account_deletion_cancel',
      userId: 'u1',
    });
    const jsx = await ConfirmPage(ctx('del-token', { action: 'cancel' }));
    render(jsx as React.ReactElement);
    expect(screen.getByRole('heading')).toBeTruthy();
  });

  it('shows invalid UI when lookup throws', async () => {
    lookupFn.mockRejectedValueOnce(new Error('invalid_token'));
    const jsx = await ConfirmPage(ctx('bad'));
    render(jsx as React.ReactElement);
    expect(screen.getByRole('heading')).toBeTruthy();
  });
});
